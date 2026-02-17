import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { taskClaims, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";

export const GET = withAgentAuth(async (_request, agent, _rateLimit) => {
  const claims = await db
    .select({
      id: taskClaims.id,
      taskId: taskClaims.taskId,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(eq(taskClaims.agentId, agent.id))
    .orderBy(taskClaims.createdAt);

  return successResponse(
    claims.map((c) => ({
      id: c.id,
      task_id: c.taskId,
      task_title: c.taskTitle,
      task_status: c.taskStatus,
      proposed_credits: c.proposedCredits,
      message: c.message,
      status: c.status,
      created_at: c.createdAt.toISOString(),
    }))
  );
});
