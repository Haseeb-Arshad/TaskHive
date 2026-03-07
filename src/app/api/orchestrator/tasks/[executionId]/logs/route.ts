import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorBaseUrl } from "@/lib/orchestrator-base-url";

const BACKEND_URL = getOrchestratorBaseUrl();

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
      `${BACKEND_URL}/orchestrator/tasks/${executionId}/logs`,
      { next: { revalidate: 0 }, signal: controller.signal }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch {
    // Backend unavailable or endpoint not implemented; return empty gracefully.
  }

  return NextResponse.json({ ok: true, data: null }, { status: 200 });
}
