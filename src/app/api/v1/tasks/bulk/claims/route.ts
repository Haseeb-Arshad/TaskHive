import { db } from "@/lib/db/client";
import { tasks, taskClaims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { validationError } from "@/lib/api/errors";
import { MAX_BULK_CLAIMS } from "@/lib/constants";
import { z } from "zod";

const bulkClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        task_id: z.number().int().positive(),
        proposed_credits: z.number().int().min(1),
        message: z.string().max(1000).optional(),
      })
    )
    .min(1)
    .max(MAX_BULK_CLAIMS),
});

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      `Send { "claims": [{ "task_id": <int>, "proposed_credits": <int> }, ...] } (max ${MAX_BULK_CLAIMS})`
    );
  }

  const parsed = bulkClaimsSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      issue.message,
      `Provide 1-${MAX_BULK_CLAIMS} claims, each with task_id and proposed_credits`
    );
  }

  const results: Array<{
    task_id: number;
    ok: boolean;
    claim_id?: number;
    error?: { code: string; message: string; suggestion?: string };
  }> = [];

  let succeeded = 0;
  let failed = 0;

  for (const claimReq of parsed.data.claims) {
    try {
      // Validate task
      const [task] = await db
        .select({
          id: tasks.id,
          status: tasks.status,
          budgetCredits: tasks.budgetCredits,
        })
        .from(tasks)
        .where(eq(tasks.id, claimReq.task_id))
        .limit(1);

      if (!task) {
        results.push({
          task_id: claimReq.task_id,
          ok: false,
          error: {
            code: "TASK_NOT_FOUND",
            message: `Task ${claimReq.task_id} does not exist`,
          },
        });
        failed++;
        continue;
      }

      if (task.status !== "open") {
        results.push({
          task_id: claimReq.task_id,
          ok: false,
          error: {
            code: "TASK_NOT_OPEN",
            message: `Task ${claimReq.task_id} is not open (status: ${task.status})`,
          },
        });
        failed++;
        continue;
      }

      if (claimReq.proposed_credits > task.budgetCredits) {
        results.push({
          task_id: claimReq.task_id,
          ok: false,
          error: {
            code: "INVALID_CREDITS",
            message: `proposed_credits (${claimReq.proposed_credits}) exceeds budget (${task.budgetCredits})`,
          },
        });
        failed++;
        continue;
      }

      // Check duplicate
      const [existing] = await db
        .select({ id: taskClaims.id })
        .from(taskClaims)
        .where(
          and(
            eq(taskClaims.taskId, claimReq.task_id),
            eq(taskClaims.agentId, agent.id),
            eq(taskClaims.status, "pending")
          )
        )
        .limit(1);

      if (existing) {
        results.push({
          task_id: claimReq.task_id,
          ok: false,
          error: {
            code: "DUPLICATE_CLAIM",
            message: `Already have a pending claim on task ${claimReq.task_id}`,
          },
        });
        failed++;
        continue;
      }

      // Create claim
      const [claim] = await db
        .insert(taskClaims)
        .values({
          taskId: claimReq.task_id,
          agentId: agent.id,
          proposedCredits: claimReq.proposed_credits,
          message: claimReq.message || null,
          status: "pending",
        })
        .returning({ id: taskClaims.id });

      results.push({ task_id: claimReq.task_id, ok: true, claim_id: claim.id });
      succeeded++;
    } catch {
      results.push({
        task_id: claimReq.task_id,
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: `Failed to process claim for task ${claimReq.task_id}`,
        },
      });
      failed++;
    }
  }

  return successResponse({
    results,
    summary: {
      succeeded,
      failed,
      total: parsed.data.claims.length,
    },
  });
});
