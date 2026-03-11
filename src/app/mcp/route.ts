import { NextRequest } from "next/server";
import { proxyMcpRoot } from "@/lib/mcp-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyMcpRoot(request);
}

export async function POST(request: NextRequest) {
  return proxyMcpRoot(request);
}

export async function DELETE(request: NextRequest) {
  return proxyMcpRoot(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyMcpRoot(request);
}

export async function HEAD(request: NextRequest) {
  return proxyMcpRoot(request);
}
