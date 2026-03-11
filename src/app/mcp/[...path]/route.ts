import { NextRequest } from "next/server";
import { proxyMcpPath } from "@/lib/mcp-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path: string[] }>;
};

async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyMcpPath(request, path);
}

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: Context) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: Context) {
  return handle(request, context);
}

export async function OPTIONS(request: NextRequest, context: Context) {
  return handle(request, context);
}

export async function HEAD(request: NextRequest, context: Context) {
  return handle(request, context);
}
