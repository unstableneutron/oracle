import { afterEach, describe, expect, test } from "vitest";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

interface RequestRecord {
  method: string;
  path: string;
  headers: Record<string, unknown>;
}

const HTTPS_KEY_PATH = path.resolve("tests/fixtures/https/localhost-key.pem");
const HTTPS_CERT_PATH = path.resolve("tests/fixtures/https/localhost-cert.pem");

describe("remote transport", () => {
  const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  afterEach(() => {
    if (typeof originalRejectUnauthorized === "undefined") {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
    }
  });

  test("uses bare host as HTTP with /runs", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "POST" && req.url === "/runs") {
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.end(`${JSON.stringify({ type: "result", result: {
          answerText: "remote answer",
          answerMarkdown: "remote answer",
          tookMs: 42,
          answerTokens: 7,
          answerChars: 12,
        } })}\n`);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { createRemoteBrowserExecutor } = await import("../../src/remote/client.js");
    const executor = createRemoteBrowserExecutor({
      host: `127.0.0.1:${server.port}`,
      token: "secret",
    });

    const result = await executor({
      prompt: "ping",
      config: {},
    });

    expect(result.answerText).toBe("remote answer");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/runs");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    await server.close();
  });

  test("uses /oracle/runs path for http:// remote URLs", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "POST" && req.url === "/oracle/runs") {
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.end(`${JSON.stringify({ type: "result", result: {
          answerText: "remote answer",
          answerMarkdown: "remote answer",
          tookMs: 42,
          answerTokens: 7,
          answerChars: 12,
        } })}\n`);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { createRemoteBrowserExecutor } = await import("../../src/remote/client.js");
    const executor = createRemoteBrowserExecutor({
      host: `http://127.0.0.1:${server.port}/oracle`,
      token: "secret",
    });

    const result = await executor({
      prompt: "ping",
      config: {},
    });

    expect(result.answerText).toBe("remote answer");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/oracle/runs");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    await server.close();
  });

  test("uses /oracle/runs path for https:// remote URLs", async () => {
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const records: RequestRecord[] = [];
    const server = await createCaptureServer("https", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "POST" && req.url === "/oracle/runs") {
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.end(`${JSON.stringify({ type: "result", result: {
          answerText: "remote answer",
          answerMarkdown: "remote answer",
          tookMs: 42,
          answerTokens: 7,
          answerChars: 12,
        } })}\n`);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { createRemoteBrowserExecutor } = await import("../../src/remote/client.js");
    const executor = createRemoteBrowserExecutor({
      host: `https://127.0.0.1:${server.port}/oracle`,
      token: "secret",
    });

    const result = await executor({
      prompt: "ping",
      config: {},
    });

    expect(result.answerText).toBe("remote answer");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/oracle/runs");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    await server.close();
  });

  test("fails TLS transport for https:// when server is plain HTTP", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });
      res.writeHead(404);
      res.end();
    });

    const { createRemoteBrowserExecutor } = await import("../../src/remote/client.js");
    const executor = createRemoteBrowserExecutor({
      host: `https://127.0.0.1:${server.port}`,
      token: "secret",
    });

    await expect(
      executor({
        prompt: "ping",
        config: {},
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(
        /SSL|TLS|certificate|wrong version|alert|ECONNRESET|socket hang up|unexpected/i,
      ),
    });

    expect(records).toHaveLength(0);

    await server.close();
  });

  test("probes bare /health with plain HTTP", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: "1.0.0", uptimeSeconds: 3 }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { checkRemoteHealth } = await import("../../src/remote/health.js");
    const result = await checkRemoteHealth({
      host: `127.0.0.1:${server.port}`,
      token: "secret",
      timeoutMs: 1500,
    });

    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/health");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    await server.close();
  });

  test("probes URL remote hosts for TCP connectivity", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      res.writeHead(404);
      res.end();
    });

    const { checkTcpConnection } = await import("../../src/remote/health.js");
    const result = await checkTcpConnection(`http://127.0.0.1:${server.port}/oracle`);

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    await server.close();
    expect(records).toHaveLength(0);
  });

  test("probes root /health for explicit http URLs", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("http", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: "1.0.0", uptimeSeconds: 3 }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { checkRemoteHealth } = await import("../../src/remote/health.js");
    const result = await checkRemoteHealth({
      host: `http://127.0.0.1:${server.port}`,
      token: "secret",
      timeoutMs: 1500,
    });

    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/health");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    await server.close();
  });

  test("probes /oracle/health via HTTPS endpoint", async () => {
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const records: RequestRecord[] = [];
    const server = await createCaptureServer("https", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });

      if (req.method === "GET" && req.url === "/oracle/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: "1.0.0", uptimeSeconds: 3 }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const { checkRemoteHealth } = await import("../../src/remote/health.js");
    const result = await checkRemoteHealth({
      host: `https://127.0.0.1:${server.port}/oracle`,
      token: "secret",
    });

    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("/oracle/health");
    expect(records[0].headers.authorization).toBe("Bearer secret");

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    await server.close();
  });

  test("surfaces self-signed certificate errors as-is", async () => {
    const records: RequestRecord[] = [];
    const server = await createCaptureServer("https", (req, res) => {
      records.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: { ...req.headers },
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, version: "ignored" }));
    });

    const { checkRemoteHealth } = await import("../../src/remote/health.js");
    const result = await checkRemoteHealth({
      host: `https://127.0.0.1:${server.port}/oracle`,
      token: "secret",
      timeoutMs: 1500,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/certificate/i);
    expect(records).toHaveLength(0);

    await server.close();
  });
});

async function createCaptureServer(
  transport: "http" | "https",
  onRequest: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ port: number; close: () => Promise<void> }> {
  const requestListener = (req: http.IncomingMessage, res: http.ServerResponse) => {
    onRequest(req, res);
  };

  const server =
    transport === "https"
      ? https.createServer(
          {
            key: await fs.readFile(HTTPS_KEY_PATH, "utf8"),
            cert: await fs.readFile(HTTPS_CERT_PATH, "utf8"),
          },
          requestListener,
        )
      : http.createServer(requestListener);

  return await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine server port"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      });
    });
    server.on("error", reject);
  });
}
