import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId || isNaN(parseInt(taskId, 10))) {
    return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/orchestrator/tasks/by-task/${taskId}/active`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Backend unreachable — return graceful not-started response so the
    // frontend polling loop doesn't break.
    return NextResponse.json(
      { ok: true, data: null, reason: "backend_unavailable" },
      { status: 200 }
    );
  }
}
