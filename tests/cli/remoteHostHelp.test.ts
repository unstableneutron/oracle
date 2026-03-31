import { promisify } from "node:util";
import { execFile } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const CLI_ENTRY = path.join(process.cwd(), "bin", "oracle-cli.ts");

describe("remote-host help text", () => {
  const runHelp = async (args: string[]): Promise<string> => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", CLI_ENTRY, ...args],
      {
        env: {
          ...process.env,
          FORCE_COLOR: "0",
        },
      },
    );
    return `${stdout}${stderr ?? ""}`;
  };

  it("advertises <host-or-url> for root --remote-host", async () => {
    const output = await runHelp(["--help"]);
    expect(output).toMatch(/--remote-host <host-or-url>/);
    expect(output).toMatch(
      /--remote-host <host-or-url>[\s\S]*host:port[\s\S]*http\(s\):\/\//,
    );
  });

  it("advertises <host-or-url> for restart --remote-host", async () => {
    const output = await runHelp(["restart", "--help"]);
    expect(output).toMatch(/--remote-host <host-or-url>/);
    expect(output).toMatch(
      /--remote-host <host-or-url>[\s\S]*host:port[\s\S]*http\(s\):\/\//,
    );
  });
});
