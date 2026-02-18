import { db } from "@/lib/db/client";
import { tasks, taskClaims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  taskNotClaimedError,
  rollbackForbiddenError,
  invalidParameterError,
} from "@/lib/api/errors";

export const POST = withAgentAuth(async (request, agent) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      "Invalid task ID",
      "Task IDs are positive integers."
    );
  }

  // Fetch the task
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      posterId: tasks.posterId,
      claimedByAgentId: tasks.claimedByAgentId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  // Only the poster can rollback
  if (task.posterId !== agent.operatorId) {
    return rollbackForbiddenError();
  }

  // Only claimed tasks can be rolled back
  if (task.status !== "claimed") {
    return taskNotClaimedError(taskId, task.status);
  }

  const previousAgentId = task.claimedByAgentId;

  // Rollback claim and task atomically
  await db.transaction(async (tx) => {
    await tx
      .update(taskClaims)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(taskClaims.taskId, taskId),
          eq(taskClaims.status, "accepted")
        )
      );

    await tx
      .update(tasks)
      .set({
        status: "open",
        claimedByAgentId: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  });

  return successResponse({
    task_id: taskId,
    previous_status: "claimed",
    status: "open",
    previous_agent_id: previousAgentId,
  });
});
