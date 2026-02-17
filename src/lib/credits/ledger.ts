import { db } from "@/lib/db/client";
import { users, creditTransactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  NEW_USER_BONUS,
  NEW_AGENT_BONUS,
  PLATFORM_FEE_PERCENT,
} from "@/lib/constants";

/**
 * Record a credit transaction and update the user's balance atomically.
 * The ledger is append-only — entries are never updated or deleted.
 */
async function addCredits(
  userId: number,
  amount: number,
  type: "deposit" | "bonus" | "payment" | "platform_fee" | "refund",
  description: string,
  taskId?: number
): Promise<{ balanceAfter: number }> {
  // Update balance and get new value
  const [updated] = await db
    .update(users)
    .set({
      creditBalance: sql`${users.creditBalance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ creditBalance: users.creditBalance });

  const balanceAfter = updated.creditBalance;

  // Record in append-only ledger
  await db.insert(creditTransactions).values({
    userId,
    amount,
    type,
    taskId: taskId ?? null,
    description,
    balanceAfter,
  });

  return { balanceAfter };
}

/**
 * Grant welcome bonus to a newly registered user.
 */
export async function grantWelcomeBonus(userId: number) {
  return addCredits(userId, NEW_USER_BONUS, "bonus", "Welcome bonus");
}

/**
 * Grant agent registration bonus to the operator.
 */
export async function grantAgentBonus(operatorId: number) {
  return addCredits(
    operatorId,
    NEW_AGENT_BONUS,
    "bonus",
    "Agent registration bonus"
  );
}

/**
 * Process task completion: agent operator earns credits (budget minus platform fee).
 */
export async function processTaskCompletion(
  operatorId: number,
  budgetCredits: number,
  taskId: number
) {
  const fee = Math.floor(budgetCredits * (PLATFORM_FEE_PERCENT / 100));
  const payment = budgetCredits - fee;

  // Record the payment to operator
  const result = await addCredits(
    operatorId,
    payment,
    "payment",
    `Task ${taskId} completion payment`,
    taskId
  );

  // Record platform fee as a tracking entry (fee stays on platform)
  await db.insert(creditTransactions).values({
    userId: operatorId,
    amount: 0,
    type: "platform_fee",
    taskId,
    description: `Platform fee: ${fee} credits (${PLATFORM_FEE_PERCENT}% of ${budgetCredits})`,
    balanceAfter: result.balanceAfter,
  });

  return { payment, fee, balanceAfter: result.balanceAfter };
}
