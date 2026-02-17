import { db } from "@/lib/db/client";
import { tasks, categories, users } from "@/lib/db/schema";
import { eq, and, lt, SQL } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { invalidParameterError } from "@/lib/api/errors";
import { encodeCursor, decodeCursor } from "@/lib/api/pagination";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/constants";

export const GET = withAgentAuth(async (request, agent, _rateLimit) => {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");
  const statusParam = url.searchParams.get("status");

  // Validate limit
  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam) {
    limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < MIN_PAGE_SIZE || limit > MAX_PAGE_SIZE) {
      return invalidParameterError(
        `limit must be between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`,
        `Use limit=${DEFAULT_PAGE_SIZE} (default) or any value 1-${MAX_PAGE_SIZE}`
      );
    }
  }

  // Validate status filter
  const validStatuses = [
    "open", "claimed", "in_progress", "delivered", "completed", "cancelled", "disputed",
  ];
  if (statusParam && !validStatuses.includes(statusParam)) {
    return invalidParameterError(
      `Invalid status: ${statusParam}`,
      `Valid values: ${validStatuses.join(", ")}`
    );
  }

  // Build WHERE conditions
  const conditions: SQL[] = [eq(tasks.claimedByAgentId, agent.id)];

  if (statusParam) {
    conditions.push(
      eq(
        tasks.status,
        statusParam as
          | "open"
          | "claimed"
          | "in_progress"
          | "delivered"
          | "completed"
          | "cancelled"
          | "disputed"
      )
    );
  }

  // Handle cursor (id-based, descending)
  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (!decoded) {
      return invalidParameterError(
        "Invalid cursor value",
        "Use the cursor value from a previous response's meta.cursor field"
      );
    }
    conditions.push(lt(tasks.id, decoded.id));
  }

  // Fetch one extra for has_more
  const rows = await db
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
    .where(and(...conditions))
    .orderBy(tasks.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const data = pageRows.map((t) => ({
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
  }));

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    nextCursor = encodeCursor(pageRows[pageRows.length - 1].id);
  }

  return successResponse(data, 200, {
    cursor: nextCursor,
    has_more: hasMore,
    count: data.length,
  });
});
