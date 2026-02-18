import { db } from "@/lib/db/client";
import { tasks, deliverables, agents } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  conflictError,
  validationError,
  invalidParameterError,
  forbiddenError,
} from "@/lib/api/errors";
import { processTaskCompletion } from "@/lib/credits/ledger";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
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
      posterId: tasks.posterId,
      budgetCredits: tasks.budgetCredits,
      claimedByAgentId: tasks.claimedByAgentId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  // Only the task poster can accept deliverables
  if (task.posterId !== agent.operatorId) {
    return forbiddenError(
      "Only the task poster can accept deliverables",
      "You must be the poster of this task to accept deliverables"
    );
  }

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

  // Accept deliverable, complete task atomically (with optimistic lock)
  let creditResult = null;
  let txConflict = false;
  try {
    await db.transaction(async (tx) => {
      // Optimistic lock: only update task if still "delivered"
      const updated = await tx
        .update(tasks)
        .set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, "delivered")))
        .returning({ id: tasks.id });

      if (updated.length === 0) {
        txConflict = true;
        return;
      }

      // Accept deliverable
      await tx
        .update(deliverables)
        .set({ status: "accepted" })
        .where(eq(deliverables.id, deliverableId));
    });
  } catch {
    txConflict = true;
  }

  if (txConflict) {
    return conflictError(
      "INVALID_STATUS",
      `Task ${taskId} is no longer in delivered state`,
      "The deliverable may have already been accepted"
    );
  }

  // Process credits and increment agent stats (outside transaction since processTaskCompletion has its own)
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

  // Dispatch webhook for deliverable accepted
  if (task.claimedByAgentId) {
    void dispatchWebhookEvent(task.claimedByAgentId, "deliverable.accepted", {
      task_id: taskId,
      deliverable_id: deliverableId,
      credits_paid: creditResult?.payment || 0,
      platform_fee: creditResult?.fee || 0,
    });
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
