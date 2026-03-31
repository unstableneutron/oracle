const REMOTE_HOST_HELP =
  "Accepted forms for --remote-host are: host:port (defaults to HTTP), http://host[:port][/base-path], or https://host[:port][/base-path]. " +
  "When using URL inputs without an explicit port, defaults are 80/443 for http/https.";

export interface RemoteEndpoint {
  transport: "http" | "https";
  original: string;
  isUrlInput: boolean;
  hostname: string;
  port: number;
  basePath: string;
}

export function parseRemoteEndpoint(raw: string): RemoteEndpoint {
  const input = raw.trim();
  if (!input) {
    throw new Error(`Expected --remote-host value, but received empty input. ${REMOTE_HOST_HELP}`);
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) {
    return parseEndpointUrl(input);
  }

  return parseBareEndpoint(input);
}

function parseEndpointUrl(raw: string): RemoteEndpoint {
  let url: URL;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new Error(`Invalid --remote-host URL: ${error instanceof Error ? error.message : String(error)} ${REMOTE_HOST_HELP}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Unsupported scheme "${url.protocol}" in --remote-host. ${REMOTE_HOST_HELP}`,
    );
  }

  if (url.username || url.password) {
    throw new Error(`Embedded credentials are not allowed in --remote-host. ${REMOTE_HOST_HELP}`);
  }
  if (url.search) {
    throw new Error(`Query parameters are not supported in --remote-host. ${REMOTE_HOST_HELP}`);
  }
  if (url.hash) {
    throw new Error(`Fragments are not supported in --remote-host. ${REMOTE_HOST_HELP}`);
  }

  const hostname = url.hostname?.trim();
  if (!hostname) {
    throw new Error(`Expected --remote-host to contain a valid host. ${REMOTE_HOST_HELP}`);
  }

  const transport = url.protocol.slice(0, -1) as RemoteEndpoint["transport"];
  const port = parsePort(url.port, transport === "http" ? 80 : 443);

  return {
    transport,
    original: raw,
    isUrlInput: true,
    hostname,
    port,
    basePath: normalizeBasePath(url.pathname),
  };
}

function parseBareEndpoint(raw: string): RemoteEndpoint {
  if (raw.includes("@")) {
    throw new Error(`Embedded credentials are not allowed in --remote-host. ${REMOTE_HOST_HELP}`);
  }
  if (raw.includes("?") || raw.includes("#")) {
    throw new Error(`Expected --remote-host to be in a supported form. Query parameters and fragments are not supported. ${REMOTE_HOST_HELP}`);
  }
  if (raw.includes("/")) {
    throw new Error(
      `Expected --remote-host to be host:port when no scheme is used (no-scheme input defaults to HTTP). ${REMOTE_HOST_HELP}`,
    );
  }

  const bracketMatch = raw.match(/^\[(.+)]:(\d+)$/);
  if (bracketMatch) {
    const hostname = bracketMatch[1]?.trim();
    if (!hostname) {
      throw new Error(`Expected --remote-host to contain a valid host. ${REMOTE_HOST_HELP}`);
    }
    return {
      transport: "http",
      original: raw,
      isUrlInput: false,
      hostname,
      port: parsePort(bracketMatch[2], undefined),
      basePath: "",
    };
  }

  if (raw.startsWith("[") && raw.endsWith("]")) {
    throw new Error(`Expected --remote-host to be host:port when no scheme is used (no-scheme input defaults to HTTP). ${REMOTE_HOST_HELP}`);
  }

  const lastColon = raw.lastIndexOf(":");
  if (lastColon === -1) {
    throw new Error(`Expected --remote-host to be host:port when no scheme is used (no-scheme input defaults to HTTP). ${REMOTE_HOST_HELP}`);
  }

  const hostname = raw.slice(0, lastColon).trim();
  const portText = raw.slice(lastColon + 1).trim();

  if (!hostname) {
    throw new Error(`Expected --remote-host to contain a valid host. ${REMOTE_HOST_HELP}`);
  }
  if (!portText) {
    throw new Error(`Expected --remote-host to be host:port when no scheme is used (no-scheme input defaults to HTTP). ${REMOTE_HOST_HELP}`);
  }
  if (hostname.includes(":")) {
    throw new Error(
      `Expected --remote-host host to be IPv6 in brackets, for example [2001:db8::1]:9473. ${REMOTE_HOST_HELP}`,
    );
  }

  return {
    transport: "http",
    original: raw,
    isUrlInput: false,
    hostname,
    port: parsePort(portText, undefined),
    basePath: "",
  };
}

function parsePort(raw: string, defaultPort?: number): number {
  if (!raw) {
    if (typeof defaultPort === "number") {
      return defaultPort;
    }
    throw new Error(`Expected --remote-host to be host:port and the port must be 1-65535. ${REMOTE_HOST_HELP}`);
  }
  if (!/^(?:0|[1-9]\d{0,4})$/.test(raw)) {
    throw new Error(`Expected --remote-host to be host:port and the port must be 1-65535. ${REMOTE_HOST_HELP}`);
  }
  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Expected --remote-host port to be between 1 and 65535. ${REMOTE_HOST_HELP}`);
  }
  return port;
}

export function joinRemotePath(
  endpoint: RemoteEndpoint,
  suffix: "/health" | "/runs",
): string {
  const normalizedBasePath = normalizeBasePath(endpoint.basePath);
  return normalizedBasePath.length ? `${normalizedBasePath}${suffix}` : suffix;
}

function normalizeBasePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}
