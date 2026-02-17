import { db } from "@/lib/db/client";
import { tasks, deliverables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  conflictError,
  validationError,
  invalidParameterError,
} from "@/lib/api/errors";

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
    return validationError(
      "Invalid JSON body",
      'Send { "deliverable_id": <int>, "revision_notes": "<feedback>" }'
    );
  }

  const deliverableId = body.deliverable_id;
  const revisionNotes = body.revision_notes || "";

  if (!Number.isInteger(deliverableId) || deliverableId < 1) {
    return validationError(
      "deliverable_id is required",
      "Include deliverable_id in request body"
    );
  }

  // Validate task
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      maxRevisions: tasks.maxRevisions,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  if (task.status !== "delivered") {
    return conflictError(
      "INVALID_STATUS",
      `Task ${taskId} is not in delivered state (status: ${task.status})`,
      "Revisions can only be requested on delivered tasks"
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

  // Check if max revisions would be exceeded
  if (deliverable.revisionNumber >= task.maxRevisions + 1) {
    return conflictError(
      "MAX_REVISIONS",
      `Maximum revisions reached (${deliverable.revisionNumber} of ${task.maxRevisions + 1} deliveries)`,
      "No more revisions allowed. Accept or reject the deliverable."
    );
  }

  // Request revision
  await db
    .update(deliverables)
    .set({
      status: "revision_requested",
      revisionNotes: revisionNotes,
    })
    .where(eq(deliverables.id, deliverableId));

  // Move task back to in_progress
  await db
    .update(tasks)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  return successResponse({
    task_id: taskId,
    deliverable_id: deliverableId,
    status: "revision_requested",
    revision_notes: revisionNotes,
    message: `Revision requested on deliverable ${deliverableId}. Task ${taskId} is back to in_progress.`,
  });
});
