import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, categories, users, taskClaims } from "@/lib/db/schema";
import {
  eq,
  and,
  gte,
  lte,
  lt,
  gt,
  desc,
  asc,
  sql,
  count,
} from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { invalidParameterError } from "@/lib/api/errors";
import { browseTasksSchema } from "@/lib/validators/tasks";
import { encodeCursor, decodeCursor } from "@/lib/api/pagination";

export const GET = withAgentAuth(async (request, _agent, _rateLimit) => {
  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = browseTasksSchema.safeParse(rawParams);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return invalidParameterError(
      issue.message,
      "Valid parameters: status, category, min_budget, max_budget, sort (newest|oldest|budget_high|budget_low), cursor, limit (1-100)"
    );
  }

  const { status, category, min_budget, max_budget, sort, cursor, limit } =
    parsed.data;

  // Build WHERE conditions
  const conditions = [eq(tasks.status, status)];

  if (category) {
    conditions.push(eq(tasks.categoryId, category));
  }
  if (min_budget !== undefined) {
    conditions.push(gte(tasks.budgetCredits, min_budget));
  }
  if (max_budget !== undefined) {
    conditions.push(lte(tasks.budgetCredits, max_budget));
  }

  // Handle cursor
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return invalidParameterError(
        "Invalid cursor value",
        "Use the cursor value from a previous response's meta.cursor field"
      );
    }

    // Cursor-based filtering depends on sort order
    switch (sort) {
      case "newest":
        conditions.push(lt(tasks.id, decoded.id));
        break;
      case "oldest":
        conditions.push(gt(tasks.id, decoded.id));
        break;
      case "budget_high":
        conditions.push(
          sql`(${tasks.budgetCredits} < ${Number(decoded.v)} OR (${tasks.budgetCredits} = ${Number(decoded.v)} AND ${tasks.id} < ${decoded.id}))`
        );
        break;
      case "budget_low":
        conditions.push(
          sql`(${tasks.budgetCredits} > ${Number(decoded.v)} OR (${tasks.budgetCredits} = ${Number(decoded.v)} AND ${tasks.id} > ${decoded.id}))`
        );
        break;
    }
  }

  // Determine sort order
  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = [desc(tasks.id)];
      break;
    case "oldest":
      orderBy = [asc(tasks.id)];
      break;
    case "budget_high":
      orderBy = [desc(tasks.budgetCredits), desc(tasks.id)];
      break;
    case "budget_low":
      orderBy = [asc(tasks.budgetCredits), asc(tasks.id)];
      break;
  }

  // Fetch one extra to determine has_more
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      budgetCredits: tasks.budgetCredits,
      categoryId: tasks.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      status: tasks.status,
      posterId: users.id,
      posterName: users.name,
      deadline: tasks.deadline,
      maxRevisions: tasks.maxRevisions,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .innerJoin(users, eq(tasks.posterId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Get claims counts for all tasks in this page
  const taskIds = pageRows.map((r) => r.id);
  let claimsCounts: Record<number, number> = {};
  if (taskIds.length > 0) {
    const countsResult = await db
      .select({
        taskId: taskClaims.taskId,
        count: count(),
      })
      .from(taskClaims)
      .where(sql`${taskClaims.taskId} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(taskClaims.taskId);

    claimsCounts = Object.fromEntries(
      countsResult.map((r) => [r.taskId, Number(r.count)])
    );
  }

  // Format response
  const data = pageRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    budget_credits: row.budgetCredits,
    category: row.categoryId
      ? { id: row.categoryId, name: row.categoryName, slug: row.categorySlug }
      : null,
    status: row.status,
    poster: { id: row.posterId, name: row.posterName },
    claims_count: claimsCounts[row.id] || 0,
    deadline: row.deadline?.toISOString() || null,
    max_revisions: row.maxRevisions,
    created_at: row.createdAt.toISOString(),
  }));

  // Build cursor for next page
  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const lastRow = pageRows[pageRows.length - 1];
    const sortValue =
      sort === "budget_high" || sort === "budget_low"
        ? String(lastRow.budgetCredits)
        : undefined;
    nextCursor = encodeCursor(lastRow.id, sortValue);
  }

  return successResponse(data, 200, {
    cursor: nextCursor,
    has_more: hasMore,
    count: data.length,
  });
});
