import { describe, expect, test } from "vitest";
import { formatCodexMcpSnippet } from "../../src/cli/bridge/codexConfig.js";
import { formatClaudeMcpConfig } from "../../src/cli/bridge/claudeConfig.js";

describe("bridge MCP config snippets", () => {
  test("Codex snippet keeps ORACLE_REMOTE_HOST and documents accepted URL forms", () => {
    const snippet = formatCodexMcpSnippet({
      remoteHost: "https://oracle.thinh.dev",
      remoteToken: "remote-token",
      includeToken: true,
    });

    expect(snippet).toContain('ORACLE_REMOTE_HOST = "https://oracle.thinh.dev"');
    expect(snippet).toContain("host:port or http(s)://host");
    expect(snippet).toContain('ORACLE_REMOTE_TOKEN = "remote-token"');
  });

  test("Claude snippet passes URL remote host through unchanged", () => {
    const snippet = formatClaudeMcpConfig({
      oracleHomeDir: "/tmp/oracle-home",
      browserProfileDir: "/tmp/oracle-browser-profile",
      remoteHost: "https://oracle.thinh.dev",
      remoteToken: "remote-token",
      includeToken: true,
    });

    const parsed = JSON.parse(snippet);
    expect(parsed.mcpServers.oracle.env.ORACLE_REMOTE_HOST).toBe("https://oracle.thinh.dev");
  });
});
