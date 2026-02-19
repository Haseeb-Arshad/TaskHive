import { db } from "@/lib/db/client";
import { tasks, taskClaims, agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  forbiddenError,
  invalidParameterError,
} from "@/lib/api/errors";
import { decryptKey } from "@/lib/crypto/encrypt";

/**
 * GET /api/v1/tasks/:id/review-config
 *
 * Returns LLM configuration for the Reviewer Agent.
 * The reviewer agent uses this to determine which LLM key to use
 * (poster's key first if under limit, then freelancer's, then none).
 *
 * Only accessible to the agent that claimed the task OR any agent on
 * tasks with auto_review_enabled.
 */
export const GET = withAgentAuth(async (request, _agent, _rateLimit) => {
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

  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      autoReviewEnabled: tasks.autoReviewEnabled,
      posterLlmKeyEncrypted: tasks.posterLlmKeyEncrypted,
      posterLlmProvider: tasks.posterLlmProvider,
      posterMaxReviews: tasks.posterMaxReviews,
      posterReviewsUsed: tasks.posterReviewsUsed,
      claimedByAgentId: tasks.claimedByAgentId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  if (!task.autoReviewEnabled) {
    return forbiddenError(
      `Task ${taskId} does not have automated review enabled`,
      "Auto review must be enabled on the task by the poster"
    );
  }

  // Decrypt poster key if available and under limit
  let posterKey: string | null = null;
  const posterUnderLimit =
    task.posterMaxReviews === null ||
    task.posterReviewsUsed < task.posterMaxReviews;

  if (task.posterLlmKeyEncrypted && posterUnderLimit) {
    try {
      posterKey = decryptKey(task.posterLlmKeyEncrypted);
    } catch {
      posterKey = null;
    }
  }

  // Get freelancer's LLM key if task is claimed
  let freelancerKey: string | null = null;
  let freelancerProvider: string | null = null;

  if (task.claimedByAgentId) {
    const [claimedAgent] = await db
      .select({
        freelancerLlmKeyEncrypted: agents.freelancerLlmKeyEncrypted,
        freelancerLlmProvider: agents.freelancerLlmProvider,
      })
      .from(agents)
      .where(eq(agents.id, task.claimedByAgentId))
      .limit(1);

    if (claimedAgent?.freelancerLlmKeyEncrypted) {
      try {
        freelancerKey = decryptKey(claimedAgent.freelancerLlmKeyEncrypted);
        freelancerProvider = claimedAgent.freelancerLlmProvider || null;
      } catch {
        freelancerKey = null;
      }
    }
  }

  // Resolve which key to use: poster first (if under limit), then freelancer, then none
  let resolvedKey: string | null = null;
  let resolvedProvider: string | null = null;
  let keySource: "poster" | "freelancer" | "none" = "none";

  if (posterKey) {
    resolvedKey = posterKey;
    resolvedProvider = task.posterLlmProvider || null;
    keySource = "poster";
  } else if (freelancerKey) {
    resolvedKey = freelancerKey;
    resolvedProvider = freelancerProvider;
    keySource = "freelancer";
  }

  return successResponse({
    task_id: taskId,
    auto_review_enabled: task.autoReviewEnabled,
    // Resolved key to use (poster priority → freelancer → none)
    resolved_key: resolvedKey,
    resolved_provider: resolvedProvider,
    key_source: keySource,
    // Poster key info
    poster_provider: task.posterLlmProvider || null,
    poster_max_reviews: task.posterMaxReviews,
    poster_reviews_used: task.posterReviewsUsed,
    poster_under_limit: posterUnderLimit,
    // Freelancer key availability (key value hidden, just provider)
    freelancer_provider: freelancerProvider,
    freelancer_key_available: freelancerKey !== null,
  });
});
