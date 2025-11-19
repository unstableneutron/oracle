import type { BrowserSessionConfig } from '../sessionManager.js';
import type { ModelName } from '../oracle.js';
import { DEFAULT_MODEL_TARGET, parseDuration } from '../browserMode.js';
import type { CookieParam } from '../browser/types.js';

const DEFAULT_BROWSER_TIMEOUT_MS = 900_000;
const DEFAULT_BROWSER_INPUT_TIMEOUT_MS = 30_000;
const DEFAULT_CHROME_PROFILE = 'Default';

const BROWSER_MODEL_LABELS: Record<ModelName, string> = {
  'gpt-5-pro': 'GPT-5 Pro',
  'gpt-5.1': 'GPT-5.1',
  'gemini-3-pro': 'Gemini 3 Pro',
};

export interface BrowserFlagOptions {
  browserChromeProfile?: string;
  browserChromePath?: string;
  browserUrl?: string;
  browserTimeout?: string;
  browserInputTimeout?: string;
  browserNoCookieSync?: boolean;
  browserCookieNames?: string;
  browserInlineCookies?: string;
  browserHeadless?: boolean;
  browserHideWindow?: boolean;
  browserKeepBrowser?: boolean;
  browserModelLabel?: string;
  browserAllowCookieErrors?: boolean;
  model: ModelName;
  verbose?: boolean;
}

export function buildBrowserConfig(options: BrowserFlagOptions): BrowserSessionConfig {
  const desiredModelOverride = options.browserModelLabel?.trim();
  const normalizedOverride = desiredModelOverride?.toLowerCase() ?? '';
  const baseModel = options.model.toLowerCase();
  const shouldUseOverride = normalizedOverride.length > 0 && normalizedOverride !== baseModel;
  const cookieNames = parseCookieNames(options.browserCookieNames ?? process.env.ORACLE_BROWSER_COOKIE_NAMES);
  const inlineCookies = parseInlineCookies(options.browserInlineCookies ?? process.env.ORACLE_BROWSER_COOKIES_JSON);
  return {
    chromeProfile: options.browserChromeProfile ?? DEFAULT_CHROME_PROFILE,
    chromePath: options.browserChromePath ?? null,
    url: options.browserUrl,
    timeoutMs: options.browserTimeout ? parseDuration(options.browserTimeout, DEFAULT_BROWSER_TIMEOUT_MS) : undefined,
    inputTimeoutMs: options.browserInputTimeout
      ? parseDuration(options.browserInputTimeout, DEFAULT_BROWSER_INPUT_TIMEOUT_MS)
      : undefined,
    cookieSync: options.browserNoCookieSync ? false : undefined,
    cookieNames,
    inlineCookies,
    headless: options.browserHeadless ? true : undefined,
    keepBrowser: options.browserKeepBrowser ? true : undefined,
    hideWindow: options.browserHideWindow ? true : undefined,
    desiredModel: shouldUseOverride ? desiredModelOverride : mapModelToBrowserLabel(options.model),
    debug: options.verbose ? true : undefined,
    allowCookieErrors: options.browserAllowCookieErrors ? true : undefined,
  };
}

export function mapModelToBrowserLabel(model: ModelName): string {
  return BROWSER_MODEL_LABELS[model] ?? DEFAULT_MODEL_TARGET;
}

export function resolveBrowserModelLabel(input: string | undefined, model: ModelName): string {
  const trimmed = input?.trim?.() ?? '';
  if (!trimmed) {
    return mapModelToBrowserLabel(model);
  }
  const normalizedInput = trimmed.toLowerCase();
  if (normalizedInput === model.toLowerCase()) {
    return mapModelToBrowserLabel(model);
  }
  return trimmed;
}

function parseCookieNames(raw?: string | null): string[] | undefined {
  if (!raw) return undefined;
  const names = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return names.length ? names : undefined;
}

function parseInlineCookies(raw?: string | null): CookieParam[] | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  let jsonPayload = text;
  // Attempt base64 decode first; fall back to raw text on failure.
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    if (decoded.trim().startsWith('[')) {
      jsonPayload = decoded;
    }
  } catch {
    // not base64; continue with raw text
  }
  try {
    const parsed = JSON.parse(jsonPayload) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as CookieParam[];
    }
  } catch {
    // invalid json; skip silently to keep this hidden flag non-fatal
  }
  return undefined;
}
