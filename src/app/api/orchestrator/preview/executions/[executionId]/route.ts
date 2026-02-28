import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function getWorkspaceDir(): string {
  return process.env.AGENT_WORKSPACE_DIR || path.join(process.cwd(), "agent_works");
}

interface PlanStep {
  step_number: number;
  description: string;
  commit_message?: string;
  files?: Array<{ path: string; description?: string }>;
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
  const planFile = path.join(taskDir, ".implementation_plan.json");

  if (!fs.existsSync(stateFile)) {
    return NextResponse.json({ ok: false, error: "Execution not found" }, { status: 404 });
  }

  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    const plan = fs.existsSync(planFile)
      ? JSON.parse(fs.readFileSync(planFile, "utf-8"))
      : state.plan || null;

    const completedStepNums = new Set(
      (state.completed_steps || []).map((s: { step_number: number }) => s.step_number)
    );
    const currentStepNum = state.current_step || 0;

    // Build subtasks from plan steps
    const subtasks = [];

    // Always add a "Planning" subtask first
    subtasks.push({
      id: 0,
      order_index: 0,
      title: "Planning",
      description: plan
        ? `${plan.project_type || "Project"} — ${(plan.steps || []).length} steps planned`
        : "Analyzing task and creating implementation plan",
      status: plan ? "completed" : state.status === "planning" ? "in_progress" : "pending",
      result: plan ? `${(plan.steps || []).length} steps` : null,
      files_changed: null,
    });

    // Add each plan step as a subtask
    if (plan && plan.steps) {
      for (const step of plan.steps as PlanStep[]) {
        const stepNum = step.step_number;
        const isDone = completedStepNums.has(stepNum);
        const isCurrent = stepNum === currentStepNum + 1 && !isDone && state.status === "coding";

        // Find files written for this step
        const completedStep = (state.completed_steps || []).find(
          (s: { step_number: number; files_written?: string[] }) => s.step_number === stepNum
        );
        const filesWritten = completedStep?.files_written || null;

        subtasks.push({
          id: stepNum,
          order_index: stepNum,
          title: step.description || `Step ${stepNum}`,
          description: step.files
            ? `Files: ${step.files.map((f: { path: string }) => f.path).join(", ")}`
            : step.description || `Implementation step ${stepNum}`,
          status: isDone ? "completed" : isCurrent ? "in_progress" : "pending",
          result: isDone ? completedStep?.commit || null : null,
          files_changed: filesWritten,
        });
      }
    } else if (state.status === "coding") {
      // No plan yet — show a generic "Coding" step
      subtasks.push({
        id: 1,
        order_index: 1,
        title: "Implementation",
        description: "Writing code and building the solution",
        status: "in_progress",
        result: null,
        files_changed: null,
      });
    }

    // Add testing/deploying steps if relevant
    if (["testing", "deploying", "deployed"].includes(state.status)) {
      subtasks.push({
        id: 100,
        order_index: 100,
        title: "Testing",
        description: "Running tests to validate implementation",
        status: state.status === "testing" ? "in_progress"
          : ["deploying", "deployed"].includes(state.status) ? "completed"
            : "pending",
        result: null,
        files_changed: null,
      });
    }

    if (["deploying", "deployed"].includes(state.status)) {
      subtasks.push({
        id: 101,
        order_index: 101,
        title: "Deployment",
        description: "Deploying project to hosting",
        status: state.status === "deploying" ? "in_progress"
          : state.status === "deployed" ? "completed"
            : "pending",
        result: state.deploy_url || null,
        files_changed: null,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        execution_id: taskId,
        subtasks,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to read plan data" }, { status: 500 });
  }
}
