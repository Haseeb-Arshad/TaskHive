import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-base-url";

const BACKEND_BASE_URL = getBackendBaseUrl();

function buildUpstreamUrl(
  request: NextRequest,
  upstreamPath: string,
  pathSegments: string[] = [],
) {
  const upstream = new URL(BACKEND_BASE_URL);
  const basePath = upstream.pathname.replace(/\/$/, "");
  const suffix = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";

  upstream.pathname = `${basePath}${upstreamPath}${suffix}`;
  upstream.search = request.nextUrl.search;

  return upstream;
}

function copyRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-port");
  headers.delete("x-forwarded-proto");
  headers.delete("x-forwarded-for");
  headers.delete("x-real-ip");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.delete("x-vercel-forwarded-for");
  headers.delete("x-vercel-id");

  return headers;
}

async function forward(
  request: NextRequest,
  upstreamPath: string,
  pathSegments: string[] = [],
) {
  const upstreamUrl = buildUpstreamUrl(request, upstreamPath, pathSegments);
  const headers = copyRequestHeaders(request);

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body;

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      ...(body ? { duplex: "half" as const } : {}),
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown MCP proxy failure";

    return NextResponse.json(
              {
            ok: false,
            error: {
              code: "mcp_proxy_unavailable",
              message: "Could not reach the upstream MCP server",
              suggestion: `Check TASKHIVE_BACKEND_URL and confirm the Python backend is serving ${upstreamPath}.`,
              detail,
            },
          },
      { status: 502 },
    );
  }
}

export function proxyMcpRoot(request: NextRequest) {
  return forward(request, "/mcp");
}

export function proxyMcpPath(request: NextRequest, pathSegments: string[]) {
  return forward(request, "/mcp", pathSegments);
}

export function proxyMcpV2Root(request: NextRequest) {
  return forward(request, "/mcp/v2");
}

export function proxyMcpV2Path(request: NextRequest, pathSegments: string[]) {
  return forward(request, "/mcp/v2", pathSegments);
}
