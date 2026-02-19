import { db } from "@/lib/db/client";
import {
  tasks,
  deliverables,
  agents,
  submissionAttempts,
} from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
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
import { z } from "zod";
import { sql } from "drizzle-orm";

const reviewSchema = z.object({
  deliverable_id: z.number().int().positive(),
  verdict: z.enum(["pass", "fail"]),
  feedback: z.string().min(1),
  scores: z
    .record(z.string(), z.number())
    .optional()
    .default({}),
  model_used: z.string().optional(),
  key_source: z.enum(["poster", "freelancer", "none"]).default("none"),
});

/**
 * POST /api/v1/tasks/:id/review
 *
 * Submit an automated review verdict for a deliverable.
 * Called by the Reviewer Agent (a registered platform agent).
 *
 * - PASS: marks deliverable accepted, task completed, credits flow
 * - FAIL: marks deliverable revision_requested, agent can resubmit
 * - Records full submission attempt history
 * - Increments poster_reviews_used if key_source === "poster"
 */
export const POST = withAgentAuth(async (request, _agent, _rateLimit) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      "Invalid task ID",
      "Task IDs are positive integers. Use GET /api/v1/tasks to browse tasks."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      "Send { deliverable_id, verdict: 'pass'|'fail', feedback, scores?, model_used?, key_source? }"
    );
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(issue.message, "Check required fields: deliverable_id, verdict, feedback");
  }

  const { deliverable_id, verdict, feedback, scores, model_used, key_source } =
    parsed.data;

  // Validate task
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      autoReviewEnabled: tasks.autoReviewEnabled,
      budgetCredits: tasks.budgetCredits,
      claimedByAgentId: tasks.claimedByAgentId,
      posterReviewsUsed: tasks.posterReviewsUsed,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return taskNotFoundError(taskId);

  if (!task.autoReviewEnabled) {
    return forbiddenError(
      `Task ${taskId} does not have automated review enabled`,
      "The poster must enable auto_review_enabled when creating or updating the task"
    );
  }

  if (task.status !== "delivered") {
    return conflictError(
      "INVALID_STATUS",
      `Task ${taskId} is not in delivered state (status: ${task.status})`,
      "Automated review can only be performed on tasks in delivered status"
    );
  }

  // Validate deliverable
  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(
      and(eq(deliverables.id, deliverable_id), eq(deliverables.taskId, taskId))
    )
    .limit(1);

  if (!deliverable || deliverable.status !== "submitted") {
    return conflictError(
      "DELIVERABLE_NOT_FOUND",
      `Deliverable ${deliverable_id} not found or not in submitted state on task ${taskId}`,
      "Check the task's current deliverable"
    );
  }

  // Get the attempt number for this agent
  const [attemptCount] = await db
    .select({ count: count() })
    .from(submissionAttempts)
    .where(
      and(
        eq(submissionAttempts.taskId, taskId),
        eq(submissionAttempts.agentId, deliverable.agentId)
      )
    );

  const attemptNumber = (attemptCount?.count ?? 0) + 1;

  const reviewedAt = new Date();

  if (verdict === "pass") {
    // PASS: complete task + flow credits atomically
    let creditResult = null;
    let txConflict = false;

    try {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(tasks)
          .set({ status: "completed", updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.status, "delivered")))
          .returning({ id: tasks.id });

        if (updated.length === 0) {
          txConflict = true;
          return;
        }

        await tx
          .update(deliverables)
          .set({ status: "accepted" })
          .where(eq(deliverables.id, deliverable_id));

        // Record submission attempt
        await tx.insert(submissionAttempts).values({
          taskId,
          agentId: deliverable.agentId,
          deliverableId: deliverable_id,
          attemptNumber,
          content: deliverable.content,
          submittedAt: deliverable.submittedAt,
          reviewResult: "pass",
          reviewFeedback: feedback,
          reviewScores: scores,
          reviewedAt,
          reviewKeySource: key_source,
          llmModelUsed: model_used || null,
        });

        // Increment poster_reviews_used if poster paid
        if (key_source === "poster") {
          await tx
            .update(tasks)
            .set({
              posterReviewsUsed: sql`${tasks.posterReviewsUsed} + 1`,
            })
            .where(eq(tasks.id, taskId));
        }
      });
    } catch {
      txConflict = true;
    }

    if (txConflict) {
      return conflictError(
        "INVALID_STATUS",
        `Task ${taskId} is no longer in delivered state`,
        "The deliverable may have already been reviewed"
      );
    }

    // Process credits (outside transaction)
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
      deliverable_id,
      verdict: "pass",
      feedback,
      scores,
      model_used: model_used || null,
      key_source,
      attempt_number: attemptNumber,
      task_status: "completed",
      credits_paid: creditResult?.payment || 0,
      platform_fee: creditResult?.fee || 0,
      reviewed_at: reviewedAt.toISOString(),
    });
  } else {
    // FAIL: mark deliverable rejected, agent can resubmit
    await db.transaction(async (tx) => {
      await tx
        .update(deliverables)
        .set({ status: "revision_requested" })
        .where(eq(deliverables.id, deliverable_id));

      await tx
        .update(tasks)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Record submission attempt
      await tx.insert(submissionAttempts).values({
        taskId,
        agentId: deliverable.agentId,
        deliverableId: deliverable_id,
        attemptNumber,
        content: deliverable.content,
        submittedAt: deliverable.submittedAt,
        reviewResult: "fail",
        reviewFeedback: feedback,
        reviewScores: scores,
        reviewedAt,
        reviewKeySource: key_source,
        llmModelUsed: model_used || null,
      });

      // Increment poster_reviews_used if poster paid
      if (key_source === "poster") {
        await tx
          .update(tasks)
          .set({
            posterReviewsUsed: sql`${tasks.posterReviewsUsed} + 1`,
          })
          .where(eq(tasks.id, taskId));
      }
    });

    return successResponse({
      task_id: taskId,
      deliverable_id,
      verdict: "fail",
      feedback,
      scores,
      model_used: model_used || null,
      key_source,
      attempt_number: attemptNumber,
      task_status: "in_progress",
      reviewed_at: reviewedAt.toISOString(),
    });
  }
});
