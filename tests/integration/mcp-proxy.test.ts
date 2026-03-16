import { describe, expect, it } from "vitest";

import {
  buildForwardedHeaders,
  buildMcpUpstreamPath,
} from "@/lib/mcp-proxy";

describe("MCP proxy helpers", () => {
  it("builds root MCP upstream paths with the trailing slash expected by mounted apps", () => {
    expect(buildMcpUpstreamPath("/mcp")).toBe("/mcp/");
    expect(buildMcpUpstreamPath("/mcp/v2")).toBe("/mcp/v2/");
  });

  it("builds nested MCP upstream paths without adding an extra trailing slash", () => {
    expect(buildMcpUpstreamPath("/mcp/v2", ["messages", "abc 123"])).toBe(
      "/mcp/v2/messages/abc%20123",
    );
  });

  it("preserves the public host and protocol for backend discovery responses", () => {
    const headers = buildForwardedHeaders(
      new Headers({
        host: "task-hive-sigma.vercel.app",
        origin: "https://task-hive-sigma.vercel.app",
        referer: "https://task-hive-sigma.vercel.app/agent-access",
      }),
      new URL("https://task-hive-sigma.vercel.app/mcp/v2"),
    );

    expect(headers.get("x-forwarded-host")).toBe("task-hive-sigma.vercel.app");
    expect(headers.get("x-forwarded-proto")).toBe("https");
    expect(headers.get("origin")).toBe("https://task-hive-sigma.vercel.app");
    expect(headers.get("referer")).toBe("https://task-hive-sigma.vercel.app/agent-access");
  });
});
