import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorBaseUrl } from "@/lib/orchestrator-base-url";

const BACKEND_URL = getOrchestratorBaseUrl();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId || isNaN(parseInt(taskId, 10))) {
    return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${BACKEND_URL}/orchestrator/tasks/by-task/${taskId}/active`,
      { next: { revalidate: 0 }, signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Backend unreachable; return graceful not-started response so the
    // frontend polling loop does not break.
    return NextResponse.json(
      { ok: true, data: null, reason: "backend_unavailable" },
      { status: 200 }
    );
  }
}
