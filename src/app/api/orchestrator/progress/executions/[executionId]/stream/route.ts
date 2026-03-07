import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  if (!executionId || isNaN(parseInt(executionId, 10))) {
    return NextResponse.json({ ok: false, error: "Invalid execution ID" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/orchestrator/progress/executions/${executionId}/stream`,
      {
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
        },
      }
    );

    if (!res.ok || !res.body) {
      return NextResponse.json({ ok: false, error: "Unable to open progress stream" }, { status: 502 });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Backend unavailable" }, { status: 503 });
  }
}
