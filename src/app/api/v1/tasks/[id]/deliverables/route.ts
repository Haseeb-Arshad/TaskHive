import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, deliverables } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  invalidStatusError,
  maxRevisionsError,
  validationError,
  invalidParameterError,
  forbiddenError,
} from "@/lib/api/errors";
import { createDeliverableSchema } from "@/lib/validators/tasks";

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
  // Extract task ID from URL
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      "Invalid task ID",
      "Task IDs are positive integers. Use GET /api/v1/tasks to browse available tasks."
    );
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      'Send a JSON body with { "content": "<your deliverable>" }'
    );
  }

  const parsed = createDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      issue.message,
      "Include content in request body (string, max 50000 chars)"
    );
  }

  const { content } = parsed.data;

  // Validate task exists
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      claimedByAgentId: tasks.claimedByAgentId,
      maxRevisions: tasks.maxRevisions,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return taskNotFoundError(taskId);
  }

  // Check task is in a deliverable state
  if (task.status !== "claimed" && task.status !== "in_progress") {
    return invalidStatusError(
      taskId,
      task.status,
      task.status === "open"
        ? `Claim the task first with POST /api/v1/tasks/${taskId}/claims`
        : `Task ${taskId} cannot accept deliverables in status: ${task.status}`
    );
  }

  // Check agent is the one who claimed
  if (task.claimedByAgentId !== agent.id) {
    return forbiddenError(
      `Task ${taskId} is not claimed by your agent`,
      "You can only deliver to tasks you have claimed"
    );
  }

  // Get current revision number
  const [latestDeliverable] = await db
    .select({ revisionNumber: deliverables.revisionNumber })
    .from(deliverables)
    .where(
      and(eq(deliverables.taskId, taskId), eq(deliverables.agentId, agent.id))
    )
    .orderBy(desc(deliverables.revisionNumber))
    .limit(1);

  const nextRevision = latestDeliverable
    ? latestDeliverable.revisionNumber + 1
    : 1;

  // Check max revisions (max_revisions + 1 total submissions allowed)
  if (nextRevision > task.maxRevisions + 1) {
    return maxRevisionsError(taskId, nextRevision - 1, task.maxRevisions + 1);
  }

  // Create deliverable
  const [deliverable] = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content,
      status: "submitted",
      revisionNumber: nextRevision,
    })
    .returning();

  // Update task status to delivered
  await db
    .update(tasks)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  return successResponse(
    {
      id: deliverable.id,
      task_id: deliverable.taskId,
      agent_id: deliverable.agentId,
      content: deliverable.content,
      status: deliverable.status,
      revision_number: deliverable.revisionNumber,
      submitted_at: deliverable.submittedAt.toISOString(),
    },
    201
  );
});
