import { describe, expect, it } from 'vitest';
import { resolveRunOptionsFromConfig } from '../src/cli/runOptions.js';

describe('resolveRunOptionsFromConfig', () => {
  const basePrompt = 'Hello';

  it('uses config engine when none provided and env lacks OPENAI_API_KEY', () => {
    const { resolvedEngine } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { engine: 'browser' },
      env: {},
    });
    expect(resolvedEngine).toBe('browser');
  });

  it('prefers explicit engine over config', () => {
    const { resolvedEngine } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      engine: 'api',
      userConfig: { engine: 'browser' },
    });
    expect(resolvedEngine).toBe('api');
  });

  it('uses config model when caller does not provide one', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { model: 'gpt-5.1' },
    });
    expect(runOptions.model).toBe('gpt-5.1');
  });

  it('appends prompt suffix from config', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: 'Hi',
      userConfig: { promptSuffix: '// signed' },
    });
    expect(runOptions.prompt).toBe('Hi\n// signed');
  });

  it('honors search off', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { search: 'off' },
    });
    expect(runOptions.search).toBe(false);
  });

  it('uses heartbeatSeconds from config', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { heartbeatSeconds: 5 },
    });
    expect(runOptions.heartbeatIntervalMs).toBe(5000);
  });

  it('passes filesReport/background from config', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { filesReport: true, background: false },
    });
    expect(runOptions.filesReport).toBe(true);
    expect(runOptions.background).toBe(false);
  });
});
