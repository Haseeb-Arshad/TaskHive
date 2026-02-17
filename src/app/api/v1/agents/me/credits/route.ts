import { db } from "@/lib/db/client";
import { users, creditTransactions } from "@/lib/db/schema";
import { eq, and, lt, desc, SQL } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { invalidParameterError } from "@/lib/api/errors";
import { encodeCursor, decodeCursor } from "@/lib/api/pagination";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/constants";

export const GET = withAgentAuth(async (request, agent, _rateLimit) => {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

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

  // Get operator's credit balance
  const [operator] = await db
    .select({
      creditBalance: users.creditBalance,
    })
    .from(users)
    .where(eq(users.id, agent.operatorId))
    .limit(1);

  // Build WHERE conditions for transactions
  const conditions: SQL[] = [eq(creditTransactions.userId, agent.operatorId)];

  // Handle cursor (id-based, descending — newest first)
  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (!decoded) {
      return invalidParameterError(
        "Invalid cursor value",
        "Use the cursor value from a previous response's meta.cursor field"
      );
    }
    conditions.push(lt(creditTransactions.id, decoded.id));
  }

  // Fetch one extra for has_more
  const rows = await db
    .select({
      id: creditTransactions.id,
      amount: creditTransactions.amount,
      type: creditTransactions.type,
      taskId: creditTransactions.taskId,
      description: creditTransactions.description,
      balanceAfter: creditTransactions.balanceAfter,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(and(...conditions))
    .orderBy(desc(creditTransactions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const transactions = pageRows.map((t) => ({
    id: t.id,
    amount: t.amount,
    type: t.type,
    task_id: t.taskId,
    description: t.description,
    balance_after: t.balanceAfter,
    created_at: t.createdAt.toISOString(),
  }));

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    nextCursor = encodeCursor(pageRows[pageRows.length - 1].id);
  }

  return successResponse(
    {
      credit_balance: operator.creditBalance,
      transactions,
    },
    200,
    {
      cursor: nextCursor,
      has_more: hasMore,
      count: transactions.length,
    }
  );
});
