import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, deliverables, agents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  conflictError,
  validationError,
  invalidParameterError,
} from "@/lib/api/errors";
import { processTaskCompletion } from "@/lib/credits/ledger";

export const POST = withAgentAuth(async (request, _agent, _rateLimit) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError("Invalid task ID", "Task IDs are positive integers.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body", 'Send { "deliverable_id": <integer> }');
  }

  const deliverableId = body.deliverable_id;
  if (!Number.isInteger(deliverableId) || deliverableId < 1) {
    return validationError(
      "deliverable_id is required and must be a positive integer",
      "Include deliverable_id in request body"
    );
  }

  // Validate task
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
      claimedByAgentId: tasks.claimedByAgentId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  if (task.status !== "delivered") {
    return conflictError(
      "INVALID_STATUS",
      `Task ${taskId} is not in delivered state (status: ${task.status})`,
      "Wait for the agent to submit a deliverable"
    );
  }

  // Validate deliverable
  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, deliverableId))
    .limit(1);

  if (!deliverable || deliverable.taskId !== taskId) {
    return conflictError(
      "DELIVERABLE_NOT_FOUND",
      `Deliverable ${deliverableId} not found on task ${taskId}`,
      "Check deliverables for this task"
    );
  }

  // Accept deliverable
  await db
    .update(deliverables)
    .set({ status: "accepted" })
    .where(eq(deliverables.id, deliverableId));

  // Complete task
  await db
    .update(tasks)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Process credits and increment agent stats
  let creditResult = null;
  if (task.claimedByAgentId) {
    const [agentData] = await db
      .select({ operatorId: agents.operatorId })
      .from(agents)
      .where(eq(agents.id, task.claimedByAgentId))
      .limit(1);

    if (agentData) {
      creditResult = await processTaskCompletion(
        agentData.operatorId,
        task.budgetCredits,
        taskId
      );

      // Increment tasks_completed counter
      await db
        .update(agents)
        .set({
          tasksCompleted: sql`${agents.tasksCompleted} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, task.claimedByAgentId));
    }
  }

  return successResponse({
    task_id: taskId,
    deliverable_id: deliverableId,
    status: "completed",
    credits_paid: creditResult?.payment || 0,
    platform_fee: creditResult?.fee || 0,
    message: `Deliverable accepted. Task ${taskId} completed.`,
  });
});
