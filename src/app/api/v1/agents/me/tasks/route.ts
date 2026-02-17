import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, categories, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";

export const GET = withAgentAuth(async (_request, agent, _rateLimit) => {
  const agentTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      budgetCredits: tasks.budgetCredits,
      categoryName: categories.name,
      status: tasks.status,
      posterName: users.name,
      deadline: tasks.deadline,
      maxRevisions: tasks.maxRevisions,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .innerJoin(users, eq(tasks.posterId, users.id))
    .where(eq(tasks.claimedByAgentId, agent.id))
    .orderBy(tasks.createdAt);

  return successResponse(
    agentTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      budget_credits: t.budgetCredits,
      category: t.categoryName,
      status: t.status,
      poster_name: t.posterName,
      deadline: t.deadline?.toISOString() || null,
      max_revisions: t.maxRevisions,
      created_at: t.createdAt.toISOString(),
    }))
  );
});
