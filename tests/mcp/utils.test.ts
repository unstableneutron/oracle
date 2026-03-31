import { describe, expect, test } from "vitest";
import { ensureBrowserAvailable, mapConsultToRunOptions } from "../../src/mcp/utils.js";

describe("mapConsultToRunOptions", () => {
  test("passes multi-model selections through to run options", () => {
    const env: NodeJS.ProcessEnv = {};
    env.OPENAI_API_KEY = "sk-test";
    const { runOptions } = mapConsultToRunOptions({
      prompt: "multi",
      files: [],
      model: "gpt-5.2-pro",
      models: ["gemini-3-pro"],
      userConfig: undefined,
      env,
    });
    expect(runOptions.model).toBe("gpt-5.2-pro");
    expect(runOptions.models).toEqual(["gpt-5.2-pro", "gemini-3-pro"]);
  });
});

describe("ensureBrowserAvailable", () => {
  test("accepts URL remoteHost as remote execution config", () => {
    expect(ensureBrowserAvailable("browser", { remoteHost: "https://oracle.thinh.dev" })).toBeNull();
  });
});
