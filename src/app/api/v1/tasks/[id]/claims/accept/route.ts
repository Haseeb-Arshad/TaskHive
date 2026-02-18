import { db } from "@/lib/db/client";
import { tasks, taskClaims } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  conflictError,
  validationError,
  invalidParameterError,
  forbiddenError,
} from "@/lib/api/errors";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  // .../tasks/[id]/claims/accept
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      "Invalid task ID",
      "Task IDs are positive integers."
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      'Send { "claim_id": <integer> }'
    );
  }

  const claimId = body.claim_id;
  if (!Number.isInteger(claimId) || claimId < 1) {
    return validationError(
      "claim_id is required and must be a positive integer",
      "Include claim_id in request body"
    );
  }

  // Validate task exists and poster is the agent's operator
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      posterId: tasks.posterId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  // Only the task poster can accept claims
  if (task.posterId !== agent.operatorId) {
    return forbiddenError(
      "Only the task poster can accept claims",
      "You must be the poster of this task to accept claims"
    );
  }

  if (task.status !== "open") {
    return conflictError(
      "TASK_NOT_OPEN",
      `Task ${taskId} is not open (status: ${task.status})`,
      "Only open tasks can have claims accepted"
    );
  }

  // Validate the claim
  const [claim] = await db
    .select()
    .from(taskClaims)
    .where(
      and(
        eq(taskClaims.id, claimId),
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.status, "pending")
      )
    )
    .limit(1);

  if (!claim) {
    return conflictError(
      "CLAIM_NOT_FOUND",
      `Claim ${claimId} not found or not pending on task ${taskId}`,
      "Check pending claims with GET /api/v1/tasks/:id/claims"
    );
  }

  // Accept claim, reject others, and update task atomically (with optimistic lock)
  let txConflict = false;
  try {
    await db.transaction(async (tx) => {
      // Optimistic lock: only update task if still "open"
      const updated = await tx
        .update(tasks)
        .set({
          status: "claimed",
          claimedByAgentId: claim.agentId,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, "open")))
        .returning({ id: tasks.id });

      if (updated.length === 0) {
        txConflict = true;
        return;
      }

      // Accept this claim
      await tx
        .update(taskClaims)
        .set({ status: "accepted" })
        .where(eq(taskClaims.id, claimId));

      // Reject all other pending claims
      await tx
        .update(taskClaims)
        .set({ status: "rejected" })
        .where(
          and(
            eq(taskClaims.taskId, taskId),
            ne(taskClaims.id, claimId),
            eq(taskClaims.status, "pending")
          )
        );
    });
  } catch {
    txConflict = true;
  }

  if (txConflict) {
    return conflictError(
      "TASK_NOT_OPEN",
      `Task ${taskId} is no longer open`,
      "Another claim was accepted concurrently"
    );
  }

  // Dispatch webhook for accepted claim
  void dispatchWebhookEvent(claim.agentId, "claim.accepted", {
    task_id: taskId,
    claim_id: claimId,
    agent_id: claim.agentId,
  });

  // Dispatch webhook for rejected claims (fire-and-forget, non-critical)
  void (async () => {
    try {
      const rejectedClaims = await db
        .select({ agentId: taskClaims.agentId, id: taskClaims.id })
        .from(taskClaims)
        .where(
          and(
            eq(taskClaims.taskId, taskId),
            ne(taskClaims.id, claimId),
            eq(taskClaims.status, "rejected")
          )
        );

      for (const rc of rejectedClaims) {
        void dispatchWebhookEvent(rc.agentId, "claim.rejected", {
          task_id: taskId,
          claim_id: rc.id,
          agent_id: rc.agentId,
        });
      }
    } catch {
      // Non-critical: webhook dispatch failure should not affect the response
    }
  })();

  return successResponse({
    task_id: taskId,
    claim_id: claimId,
    agent_id: claim.agentId,
    status: "accepted",
    message: `Claim ${claimId} accepted. Task ${taskId} is now claimed.`,
  });
});
