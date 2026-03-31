import { describe, expect, test } from "vitest";
import type { SessionModelRun } from "../../src/sessionStore.js";
import {
  buildConsultBrowserConfig,
  getConsultRemoteExecution,
  summarizeModelRunsForConsult,
} from "../../src/mcp/tools/consult.ts";

describe("summarizeModelRunsForConsult", () => {
  test("maps per-model metadata into consult summaries", () => {
    const runs: SessionModelRun[] = [
      {
        model: "gpt-5.2-pro",
        status: "completed",
        startedAt: "2025-11-19T00:00:00Z",
        completedAt: "2025-11-19T00:00:30Z",
        usage: { inputTokens: 1000, outputTokens: 200, reasoningTokens: 0, totalTokens: 1200 },
        response: { id: "resp_123", requestId: "req_456", status: "completed" },
        log: { path: "models/gpt-5.2-pro.log" },
      },
    ];
    const result = summarizeModelRunsForConsult(runs);
    expect(result).toEqual([
      expect.objectContaining({
        model: "gpt-5.2-pro",
        status: "completed",
        usage: expect.objectContaining({ totalTokens: 1200 }),
        response: expect.objectContaining({ id: "resp_123" }),
        logPath: "models/gpt-5.2-pro.log",
      }),
    ]);
  });

  test("returns undefined for empty lists", () => {
    expect(summarizeModelRunsForConsult([])).toBeUndefined();
    expect(summarizeModelRunsForConsult(undefined)).toBeUndefined();
  });

  test("merges browser defaults from config for consult runs", () => {
    const config = buildConsultBrowserConfig({
      userConfig: {
        browser: {
          chatgptUrl: "https://chatgpt.com/g/g-p-foo/project",
          debugPort: 9224,
          keepBrowser: true,
          manualLogin: true,
          manualLoginProfileDir: "/tmp/oracle-profile",
          thinkingTime: "extended",
        },
      },
      env: {},
      runModel: "gpt-5.1",
      inputModel: "gpt-5.1",
    });

    expect(config).toMatchObject({
      chatgptUrl: "https://chatgpt.com/g/g-p-foo/project",
      url: "https://chatgpt.com/g/g-p-foo/project",
      debugPort: 9224,
      keepBrowser: true,
      manualLogin: true,
      manualLoginProfileDir: "/tmp/oracle-profile",
      thinkingTime: "extended",
      desiredModel: "GPT-5.2",
      cookieSync: false,
    });
  });

  test("omits remote execution metadata while preserving browser settings", () => {
    const config = buildConsultBrowserConfig({
      userConfig: {
        browser: {
          chatgptUrl: "https://chatgpt.com/plus",
          debugPort: 9333,
          keepBrowser: true,
          manualLogin: true,
          thinkingTime: "extended",
          remoteHost: "https://remote-oracle.invalid",
          remoteToken: "super-secret",
          remoteViaSshReverseTunnel: {
            ssh: "ssh -N -L 9222:127.0.0.1:9222 example",
            remotePort: 9222,
            localPort: 9333,
            identity: "~/.ssh/id_ed25519",
          },
        },
      },
      env: {},
      runModel: "gpt-5.1",
      inputModel: "gpt-5.1",
    });

    expect(config).toMatchObject({
      chatgptUrl: "https://chatgpt.com/plus",
      url: "https://chatgpt.com/plus",
      debugPort: 9333,
      keepBrowser: true,
      manualLogin: true,
      thinkingTime: "extended",
      desiredModel: "GPT-5.2",
      cookieSync: false,
    });
    expect(config).not.toHaveProperty("remoteHost");
    expect(config).not.toHaveProperty("remoteToken");
    expect(config).not.toHaveProperty("remoteViaSshReverseTunnel");
  });

  test("lets explicit consult inputs override config defaults", () => {
    const config = buildConsultBrowserConfig({
      userConfig: {
        browser: {
          keepBrowser: false,
          manualLogin: false,
          manualLoginProfileDir: "/tmp/config-profile",
          thinkingTime: "light",
        },
      },
      env: {
        ORACLE_BROWSER_PROFILE_DIR: "/tmp/env-profile",
      },
      runModel: "claude-3.7-sonnet",
      inputModel: "claude-3.7-sonnet",
      browserModelLabel: "Claude Sonnet",
      browserKeepBrowser: true,
      browserThinkingTime: "heavy",
    });

    expect(config).toMatchObject({
      keepBrowser: true,
      manualLogin: true,
      manualLoginProfileDir: "/tmp/env-profile",
      thinkingTime: "heavy",
      desiredModel: "Claude Sonnet",
      cookieSync: false,
    });
  });
});


describe("consult remote execution resolver", () => {
  test("returns missing-token error for URL-valued remoteHost without token", () => {
    const result = getConsultRemoteExecution({
      resolvedEngine: "browser",
      remoteHost: "https://oracle.thinh.dev",
      remoteToken: undefined,
    });

    expect(result.useRemoteExecutor).toBe(false);
    expect(result.missingTokenError).toBe(
      "Remote host configured (https://oracle.thinh.dev) but remote token is missing. Run `oracle bridge client --connect <...>` or set ORACLE_REMOTE_TOKEN.",
    );
  });

  test("enables remote execution for URL-valued remoteHost with token", () => {
    const result = getConsultRemoteExecution({
      resolvedEngine: "browser",
      remoteHost: "https://oracle.thinh.dev",
      remoteToken: "token-123",
    });

    expect(result).toEqual({ useRemoteExecutor: true });
    expect(result.missingTokenError).toBeUndefined();
  });
});
