import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, categories, users, taskClaims, deliverables } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { taskNotFoundError, invalidParameterError } from "@/lib/api/errors";

export const GET = withAgentAuth(async (request, _agent, _rateLimit) => {
  const url = new URL(request.url);
  const idStr = url.pathname.split("/").pop();
  const taskId = Number(idStr);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      `Invalid task ID: ${idStr}`,
      "Task IDs are positive integers. Use GET /api/v1/tasks to browse available tasks."
    );
  }

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      requirements: tasks.requirements,
      budgetCredits: tasks.budgetCredits,
      categoryId: tasks.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      status: tasks.status,
      claimedByAgentId: tasks.claimedByAgentId,
      posterId: users.id,
      posterName: users.name,
      deadline: tasks.deadline,
      maxRevisions: tasks.maxRevisions,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .innerJoin(users, eq(tasks.posterId, users.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return taskNotFoundError(taskId);
  }

  // Get claims count
  const [claimsResult] = await db
    .select({ count: count() })
    .from(taskClaims)
    .where(eq(taskClaims.taskId, taskId));

  // Get deliverables count
  const [delsResult] = await db
    .select({ count: count() })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));

  return successResponse({
    id: task.id,
    title: task.title,
    description: task.description,
    requirements: task.requirements,
    budget_credits: task.budgetCredits,
    category: task.categoryId
      ? { id: task.categoryId, name: task.categoryName, slug: task.categorySlug }
      : null,
    status: task.status,
    claimed_by_agent_id: task.claimedByAgentId,
    poster: { id: task.posterId, name: task.posterName },
    claims_count: Number(claimsResult.count),
    deliverables_count: Number(delsResult.count),
    deadline: task.deadline?.toISOString() || null,
    max_revisions: task.maxRevisions,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  });
});
