import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  if (!executionId || isNaN(parseInt(executionId, 10))) {
    return NextResponse.json({ ok: false, error: "Invalid execution ID" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${BACKEND_URL}/orchestrator/progress/executions/${executionId}`,
      { next: { revalidate: 0 }, signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Backend unavailable" },
      { status: 503 }
    );
  }
}

