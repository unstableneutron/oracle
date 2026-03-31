import { describe, expect, it } from "vitest";
import { joinRemotePath, parseRemoteEndpoint } from "../../src/remote/endpoint.js";

describe("parseRemoteEndpoint", () => {
  it("parses bare host:port as HTTP", () => {
    const endpoint = parseRemoteEndpoint("127.0.0.1:9473");
    expect(endpoint).toEqual({
      transport: "http",
      original: "127.0.0.1:9473",
      isUrlInput: false,
      hostname: "127.0.0.1",
      port: 9473,
      basePath: "",
    });
  });

  it("requires bare host:port", () => {
    expect(() => parseRemoteEndpoint("127.0.0.1")).toThrow(/host:port/i);
    expect(() => parseRemoteEndpoint("not-a-host")).toThrow(/host:port/i);
  });

  it("accepts http and https URLs", () => {
    const http = parseRemoteEndpoint("http://localhost:9473/oracle/");
    expect(http.transport).toBe("http");
    expect(http.port).toBe(9473);
    expect(http.basePath).toBe("/oracle");
    expect(http.original).toBe("http://localhost:9473/oracle/");
    expect(http.isUrlInput).toBe(true);

    const https = parseRemoteEndpoint("https://example.com:9443/oracle");
    expect(https.transport).toBe("https");
    expect(https.port).toBe(9443);
    expect(https.basePath).toBe("/oracle");
    expect(https.isUrlInput).toBe(true);
  });

  it("defaults URL ports to 80/443 when URL port is omitted", () => {
    const http = parseRemoteEndpoint("http://example.com");
    const https = parseRemoteEndpoint("https://example.com");

    expect(http.port).toBe(80);
    expect(https.port).toBe(443);
  });

  it("normalizes base paths", () => {
    expect(parseRemoteEndpoint("http://example.com/").basePath).toBe("");
    expect(parseRemoteEndpoint("https://example.com/oracle/").basePath).toBe("/oracle");
  });

  it("strips all trailing slashes from non-root base path", () => {
    expect(parseRemoteEndpoint("https://example.com/oracle//").basePath).toBe("/oracle");
    expect(parseRemoteEndpoint("https://example.com/oracle///").basePath).toBe("/oracle");
  });

  it("rejects unsupported schemes", () => {
    expect(() => parseRemoteEndpoint("ftp://example.com:21")).toThrow(/Unsupported scheme/i);
    expect(() => parseRemoteEndpoint("file:///tmp/remote")).toThrow(/Unsupported scheme/i);
  });

  it("rejects malformed host input", () => {
    expect(() => parseRemoteEndpoint(""))
      .toThrow(/Expected --remote-host/i);
    expect(() => parseRemoteEndpoint("http://")).toThrow(/Invalid --remote-host/i);
    expect(() => parseRemoteEndpoint("not::valid")).toThrow(/IPv6 in brackets|Expected --remote-host/i);
    expect(() => parseRemoteEndpoint("host:99999")).toThrow(/between 1 and 65535/i);
  });

  it("rejects embedded credentials", () => {
    expect(() => parseRemoteEndpoint("https://alice:secret@example.com"))
      .toThrow(/Embedded credentials are not allowed/i);
    expect(() => parseRemoteEndpoint("alice:secret@127.0.0.1:9473")).toThrow(
      /Embedded credentials are not allowed/i,
    );
  });

  it("rejects query strings and fragments", () => {
    expect(() => parseRemoteEndpoint("https://example.com/run?query=1")).toThrow(
      /Query parameters are not supported/i,
    );
    expect(() => parseRemoteEndpoint("https://example.com/run#fragment")).toThrow(
      /Fragments are not supported/i,
    );
    expect(() => parseRemoteEndpoint("example.com?query=1")).toThrow(
      /Query parameters|fragments are not supported|not supported/i,
    );
  });

  it("mentions actionable accepted forms and no-scheme defaults guidance in errors", () => {
    expect(() => parseRemoteEndpoint("ws://example.com:80")).toThrow(
      /Accepted forms for --remote-host/i,
    );
    expect(() => parseRemoteEndpoint("127.0.0.1")).toThrow(/No-scheme input defaults to HTTP/i);
  });
});

describe("joinRemotePath", () => {
  it("builds endpoint paths from basePath", () => {
    expect(joinRemotePath(parseRemoteEndpoint("127.0.0.1:9473"), "/health")).toBe("/health");
    expect(joinRemotePath(parseRemoteEndpoint("http://example.com/oracle"), "/health")).toBe("/oracle/health");
    expect(joinRemotePath(parseRemoteEndpoint("http://example.com/oracle/"), "/runs")).toBe("/oracle/runs");
    expect(joinRemotePath(parseRemoteEndpoint("https://example.com/"), "/runs")).toBe("/runs");
  });

  it("never emits double slashes for trailing slash basePath", () => {
    expect(joinRemotePath(parseRemoteEndpoint("https://example.com/oracle//"), "/health")).toBe("/oracle/health");
  });
});
