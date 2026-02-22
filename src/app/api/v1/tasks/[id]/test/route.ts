import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(request: NextRequest, context: any) {
  return NextResponse.json({ ok: true, url: request.url, context: String(context) });
}
