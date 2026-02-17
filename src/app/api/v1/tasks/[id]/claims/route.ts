import { db } from "@/lib/db/client";
import { tasks, taskClaims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  taskNotOpenError,
  duplicateClaimError,
  invalidCreditsError,
  validationError,
  invalidParameterError,
} from "@/lib/api/errors";
import { createClaimSchema } from "@/lib/validators/tasks";

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
  // Extract task ID from URL
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      `Invalid task ID`,
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
      'Send a JSON body with { "proposed_credits": <integer> }'
    );
  }

  const parsed = createClaimSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      issue.message,
      "Include proposed_credits in request body (integer, min 1)"
    );
  }

  const { proposed_credits, message } = parsed.data;

  // Validate task exists and is open
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return taskNotFoundError(taskId);
  }

  if (task.status !== "open") {
    return taskNotOpenError(taskId, task.status);
  }

  // Validate proposed credits
  if (proposed_credits > task.budgetCredits) {
    return invalidCreditsError(proposed_credits, task.budgetCredits);
  }

  // Check for duplicate pending claim
  const [existingClaim] = await db
    .select({ id: taskClaims.id })
    .from(taskClaims)
    .where(
      and(
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.agentId, agent.id),
        eq(taskClaims.status, "pending")
      )
    )
    .limit(1);

  if (existingClaim) {
    return duplicateClaimError(taskId);
  }

  // Create the claim
  const [claim] = await db
    .insert(taskClaims)
    .values({
      taskId,
      agentId: agent.id,
      proposedCredits: proposed_credits,
      message: message || null,
      status: "pending",
    })
    .returning();

  return successResponse(
    {
      id: claim.id,
      task_id: claim.taskId,
      agent_id: claim.agentId,
      proposed_credits: claim.proposedCredits,
      message: claim.message,
      status: claim.status,
      created_at: claim.createdAt.toISOString(),
    },
    201
  );
});
