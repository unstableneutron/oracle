import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { sessionStore } from "../../src/sessionStore.js";

const execFileAsync = promisify(execFile);
const CLI_ENTRY = path.join(process.cwd(), "bin", "oracle-cli.ts");

type RunResult = { code: number; output: string };

type RunServer = {
  close: () => Promise<void>;
  path: string;
};

function getErrorOutput(error: unknown): RunResult {
  const output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`;
  const code =
    error && typeof error === "object" && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 1;

  return { code, output };
}

async function runCli(args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", CLI_ENTRY, ...args],
      {
        env: {
          ...process.env,
          FORCE_COLOR: "0",
          ...extraEnv,
        },
        timeout: 20_000,
      },
    );
    return { code: 0, output: `${stdout}${stderr ?? ""}` };
  } catch (error) {
    return getErrorOutput(error);
  }
}

async function createRunsServer(pathPrefix = ""): Promise<RunServer> {
  const prefix = pathPrefix.replace(/\/+$/, "");

  const server = http.createServer((request, response) => {
    const normalized = (request.url ?? "").replace(/\/+$/, "");

    if (
      request.method === "POST" &&
      (normalized === `${prefix}/runs` || normalized.endsWith("/runs"))
    ) {
      response.writeHead(200, { "Content-Type": "application/x-ndjson" });
      const event = {
        type: "result",
        result: {
          answerText: "restart-ok",
          answerMarkdown: "restart-ok",
          answerTokens: 5,
          tookMs: 10,
          chromePid: 1234,
          chromePort: 51515,
          chromeHost: "127.0.0.1",
          userDataDir: "/tmp",
          controllerPid: process.pid,
        },
      };
      response.end(`${JSON.stringify(event)}\n`);
      return;
    }

    if (request.method === "GET" && normalized.endsWith("/health")) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("ok\n");
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const assignedPort = (server.address() as import("node:net").AddressInfo).port;
  return {
    close: () =>
      new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
      }),
    path: `http://127.0.0.1:${assignedPort}${prefix}`,
  };
}

describe("remote-host behavior", () => {
  it("requires --engine browser when --remote-host is set on the root command", async () => {
    const result = await runCli([
      "--engine",
      "api",
      "--model",
      "gpt-5.1",
      "--remote-host",
      "https://127.0.0.1:9473",
      "-p",
      "guard with api engine",
    ]);

    expect(result.code).toBe(1);
    expect(result.output).toMatch(/--remote-host requires --engine browser\./);
  });

  it("keeps --models guard active when --remote-host is a URL", async () => {
    const result = await runCli([
      "--engine",
      "browser",
      "--remote-host",
      "https://example.local:9443/oracle",
      "--models",
      "gpt-5.1,gpt-5.2",
      "-p",
      "guard with remote URL and models",
    ]);
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/--remote-host does not support --models yet/);
  });

  it("logs remote host detection and --no-wait forcing for URL-based remote host", async () => {
    const result = await runCli([
      "--engine",
      "browser",
      "--model",
      "gpt-5.1",
      "--remote-host",
      "https://example.local:9443/oracle",
      "--no-wait",
      "--dry-run",
      "-p",
      "url remote host no-wait",
    ]);

    expect(result.code).toBe(0);
    expect(result.output).toMatch(
      /Remote browser host detected: https:\/\/example\.local:9443\/oracle/,
    );
    expect(result.output).toMatch(/Remote browser runs require --wait; ignoring --no-wait\./);
  });

  it("supports restart --no-wait with URL-valued --remote-host and a browser session fixture", async () => {
    const oracleHome = await mkdtemp(path.join(os.tmpdir(), "oracle-remotehost-restart-"));
    const previousHome = process.env.ORACLE_HOME_DIR;
    process.env.ORACLE_HOME_DIR = oracleHome;
    const remoteServer = await createRunsServer("/bridge");

    try {
      const sessionMeta = await sessionStore.createSession(
        {
          prompt: "Seeded browser session for remote restart",
          model: "gpt-5.1",
          mode: "browser",
          browserConfig: {
            desiredModel: "GPT-5.1",
            url: "https://chatgpt.com/",
          },
        },
        process.cwd(),
      );

      const result = await runCli(
        ["restart", sessionMeta.id, "--remote-host", remoteServer.path, "--no-wait"],
        {
          ORACLE_HOME_DIR: oracleHome,
          ORACLE_NO_DETACH: "1",
          ORACLE_DISABLE_KEYTAR: "1",
        },
      );

      expect(result.code).toBe(0);
      expect(result.output).toContain(`Remote browser host detected: ${remoteServer.path}`);
      expect(result.output).toMatch(/Remote browser runs require --wait; ignoring --no-wait\./);
    } finally {
      process.env.ORACLE_HOME_DIR = previousHome;
      await remoteServer.close();
      await rm(oracleHome, { recursive: true, force: true });
    }
  }, 30_000);
});
