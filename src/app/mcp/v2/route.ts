import { NextRequest } from "next/server";
import { proxyMcpV2Root } from "@/lib/mcp-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyMcpV2Root(request);
}

export async function POST(request: NextRequest) {
  return proxyMcpV2Root(request);
}

export async function DELETE(request: NextRequest) {
  return proxyMcpV2Root(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyMcpV2Root(request);
}

export async function HEAD(request: NextRequest) {
  return proxyMcpV2Root(request);
}
