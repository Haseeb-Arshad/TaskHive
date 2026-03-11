import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function buildUpstreamUrl(request: NextRequest, pathSegments: string[] = []) {
  const upstream = new URL(BACKEND_BASE_URL);
  const basePath = upstream.pathname.replace(/\/$/, "");
  const suffix = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";

  upstream.pathname = `${basePath}/mcp${suffix}`;
  upstream.search = request.nextUrl.search;

  return upstream;
}

function copyRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  return headers;
}

async function forward(request: NextRequest, pathSegments: string[] = []) {
  const upstreamUrl = buildUpstreamUrl(request, pathSegments);
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
          suggestion: "Check NEXT_PUBLIC_API_URL and confirm the Python backend is serving /mcp.",
          detail,
        },
      },
      { status: 502 },
    );
  }
}

export function proxyMcpRoot(request: NextRequest) {
  return forward(request);
}

export function proxyMcpPath(request: NextRequest, pathSegments: string[]) {
  return forward(request, pathSegments);
}
