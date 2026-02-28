import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Resolve the agent_works directory (relative to CWD or absolute via env)
function getWorkspaceDir(): string {
  return process.env.AGENT_WORKSPACE_DIR || path.join(process.cwd(), "agent_works");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId: taskIdStr } = await params;
  const taskId = parseInt(taskIdStr, 10);
  if (isNaN(taskId)) {
    return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  }

  const taskDir = path.join(getWorkspaceDir(), `task_${taskId}`);
  const stateFile = path.join(taskDir, ".swarm_state.json");

  if (!fs.existsSync(stateFile)) {
    return NextResponse.json({ ok: false, error: "No active execution for this task" }, { status: 404 });
  }

  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    // Use task_id as execution_id (they're 1:1 in this setup)
    return NextResponse.json({
      ok: true,
      data: {
        execution_id: taskId,
        task_id: taskId,
        status: state.status,
        started_at: state.started_at || null,
        workspace_path: taskDir,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read state" }, { status: 500 });
  }
}
