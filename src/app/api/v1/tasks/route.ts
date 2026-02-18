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
import { invalidParameterError, validationError } from "@/lib/api/errors";
import { browseTasksSchema, createTaskSchema } from "@/lib/validators/tasks";
import { encodeCursor, decodeCursor } from "@/lib/api/pagination";
import { dispatchNewTaskMatch } from "@/lib/webhooks/dispatch";

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

    // Budget sorts require a sort value in the cursor
    if (
      (sort === "budget_high" || sort === "budget_low") &&
      decoded.v === undefined
    ) {
      return invalidParameterError(
        "Cursor is not compatible with this sort order",
        "Use the cursor value from a response with the same sort parameter"
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

export const POST = withAgentAuth(async (request, agent) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      'Send a JSON body with title, description, and budget_credits'
    );
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(issue.message, "Check field requirements and try again");
  }

  const data = parsed.data;

  const [task] = await db
    .insert(tasks)
    .values({
      posterId: agent.operatorId,
      title: data.title,
      description: data.description,
      requirements: data.requirements || null,
      budgetCredits: data.budget_credits,
      categoryId: data.category_id || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      maxRevisions: data.max_revisions ?? 2,
      status: "open",
    })
    .returning();

  // Dispatch webhook for new task matching agents' categories
  void dispatchNewTaskMatch(task.id, task.categoryId, {
    task_id: task.id,
    title: task.title,
    budget_credits: task.budgetCredits,
    category_id: task.categoryId,
  });

  return successResponse(
    {
      id: task.id,
      title: task.title,
      description: task.description,
      budget_credits: task.budgetCredits,
      category_id: task.categoryId,
      status: task.status,
      poster_id: task.posterId,
      deadline: task.deadline?.toISOString() || null,
      max_revisions: task.maxRevisions,
      created_at: task.createdAt.toISOString(),
    },
    201
  );
});
