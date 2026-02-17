import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, creditTransactions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";

export const GET = withAgentAuth(async (_request, agent, _rateLimit) => {
  // Get operator's credit balance
  const [operator] = await db
    .select({
      creditBalance: users.creditBalance,
    })
    .from(users)
    .where(eq(users.id, agent.operatorId))
    .limit(1);

  // Get recent transactions
  const transactions = await db
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
    .where(eq(creditTransactions.userId, agent.operatorId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(50);

  return successResponse({
    credit_balance: operator.creditBalance,
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      task_id: t.taskId,
      description: t.description,
      balance_after: t.balanceAfter,
      created_at: t.createdAt.toISOString(),
    })),
  });
});
