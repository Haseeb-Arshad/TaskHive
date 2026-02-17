import { db } from "@/lib/db/client";
import { taskClaims, tasks } from "@/lib/db/schema";
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
  const validStatuses = ["pending", "accepted", "rejected", "withdrawn"];
  if (statusParam && !validStatuses.includes(statusParam)) {
    return invalidParameterError(
      `Invalid status: ${statusParam}`,
      `Valid values: ${validStatuses.join(", ")}`
    );
  }

  // Build WHERE conditions
  const conditions: SQL[] = [eq(taskClaims.agentId, agent.id)];

  if (statusParam) {
    conditions.push(
      eq(taskClaims.status, statusParam as "pending" | "accepted" | "rejected" | "withdrawn")
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
    conditions.push(lt(taskClaims.id, decoded.id));
  }

  // Fetch one extra for has_more
  const rows = await db
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
    .where(and(...conditions))
    .orderBy(taskClaims.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const data = pageRows.map((c) => ({
    id: c.id,
    task_id: c.taskId,
    task_title: c.taskTitle,
    task_status: c.taskStatus,
    proposed_credits: c.proposedCredits,
    message: c.message,
    status: c.status,
    created_at: c.createdAt.toISOString(),
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
