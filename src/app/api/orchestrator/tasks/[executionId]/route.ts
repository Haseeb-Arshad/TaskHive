import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function getWorkspaceDir(): string {
  return process.env.AGENT_WORKSPACE_DIR || path.join(process.cwd(), "agent_works");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  const taskId = parseInt(executionId, 10);
  if (isNaN(taskId)) {
    return NextResponse.json({ ok: false, error: "Invalid execution ID" }, { status: 400 });
  }

  const taskDir = path.join(getWorkspaceDir(), `task_${taskId}`);
  const stateFile = path.join(taskDir, ".swarm_state.json");

  if (!fs.existsSync(stateFile)) {
    return NextResponse.json({ ok: false, error: "Execution not found" }, { status: 404 });
  }

  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));

    // Count progress steps for token estimate
    let totalLines = 0;
    const progressFile = path.join(taskDir, "progress.jsonl");
    if (fs.existsSync(progressFile)) {
      const content = fs.readFileSync(progressFile, "utf-8");
      totalLines = content.split("\n").filter((l) => l.trim()).length;
    }

    const pipelineStatus = state.status === "testing" || state.status === "deploying"
      ? "in_progress"
      : state.status === "deployed" || state.status === "complete"
        ? "completed"
        : "in_progress";

    return NextResponse.json({
      ok: true,
      data: {
        id: taskId,
        status: pipelineStatus,
        total_tokens_used: totalLines * 1200,  // rough estimate
        total_cost_usd: null,
        attempt_count: state.iterations || 1,
        started_at: state.started_at || null,
        completed_at: state.status === "deployed" ? state.completed_at || null : null,
        workspace_path: taskDir,
        error_message: state.last_error || null,
        plan: state.plan || null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read execution data" }, { status: 500 });
  }
}
