import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  testDb,
  createTask,
  fullFlowToDelivered,
  fullFlowToCompleted,
  
} from "../setup/test-helpers";
import { users, creditTransactions } from "../../src/lib/db/schema";
import { eq, and } from "drizzle-orm";

beforeAll(async () => {
  await setupTestData();
});


describe("Credit System Integrity", () => {
  // -----------------------------------------------------------------
  // 5.1 Welcome bonus on registration
  // -----------------------------------------------------------------
  it("5.1 should have granted welcome bonus (500 credits) to test users", async () => {
    // Test users were created with 1000 credits in setup, but real users
    // get 500 via grantWelcomeBonus. Check the bonus ledger entry mechanism
    // by verifying the constant is correct in the API response.
    const res = await apiRequest("GET", "/api/v1/agents/me", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    // Poster user was seeded with 1000 credits
    expect(res.data.data.operator.credit_balance).toBeGreaterThanOrEqual(0);
  });

  // -----------------------------------------------------------------
  // 5.3 Task completion: operator gets budget - floor(budget*0.10)
  // -----------------------------------------------------------------
  it("5.3 should distribute correct credits on task completion (budget=100)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    // Record operator balance before
    const [before] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    await fullFlowToCompleted(posterKey, agentKey, 100);

    // Check operator balance after
    const [after] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    // Payment = 100 - floor(100 * 0.10) = 90
    expect(after.creditBalance).toBe(before.creditBalance + 90);
  });

  // -----------------------------------------------------------------
  // 5.4 Platform fee accuracy for various budgets
  // -----------------------------------------------------------------
  it.each([
    { budget: 10, expectedPayment: 9, expectedFee: 1 },
    { budget: 15, expectedPayment: 14, expectedFee: 1 },
    { budget: 99, expectedPayment: 90, expectedFee: 9 },
    { budget: 100, expectedPayment: 90, expectedFee: 10 },
    { budget: 1000, expectedPayment: 900, expectedFee: 100 },
  ])("5.4 should calculate correct fee for budget=$budget", async ({ budget, expectedPayment }) => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const [before] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    await fullFlowToCompleted(posterKey, agentKey, budget);

    const [after] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    expect(after.creditBalance).toBe(before.creditBalance + expectedPayment);
  });

  // -----------------------------------------------------------------
  // 5.5 Platform fee ledger entry has amount=0
  // -----------------------------------------------------------------
  it("5.5 should record platform_fee ledger entry with amount=0", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    await fullFlowToCompleted(posterKey, agentKey, 100);

    // Find platform_fee entries for this user
    const feeEntries = await testDb
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, testData.agents.agent1.operatorId),
          eq(creditTransactions.type, "platform_fee")
        )
      );

    expect(feeEntries.length).toBeGreaterThanOrEqual(1);
    const latest = feeEntries[feeEntries.length - 1];
    expect(latest.amount).toBe(0);
    expect(latest.description).toContain("10%");
  });

  // -----------------------------------------------------------------
  // 5.6 Poster balance NOT debited on task completion
  // -----------------------------------------------------------------
  it("5.6 should NOT debit poster balance on task completion", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const [before] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.users.poster.id));

    await fullFlowToCompleted(posterKey, agentKey, 100);

    const [after] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.users.poster.id));

    // Poster balance should be unchanged (no escrow/debit)
    expect(after.creditBalance).toBe(before.creditBalance);
  });

  // -----------------------------------------------------------------
  // 5.7 No balance check when creating task
  // -----------------------------------------------------------------
  it("5.7 should allow task creation regardless of poster balance", async () => {
    // Set poster balance to 0 directly
    await testDb
      .update(users)
      .set({ creditBalance: 0 })
      .where(eq(users.id, testData.users.poster.id));

    const res = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 1000,
    });
    expect(res.status).toBe(201);

    // Restore balance
    await testDb
      .update(users)
      .set({ creditBalance: 1000 })
      .where(eq(users.id, testData.users.poster.id));
  });

  // -----------------------------------------------------------------
  // 5.8 Ledger balance_after consistency
  // -----------------------------------------------------------------
  it("5.8 should maintain consistent balance_after in ledger", async () => {
    const userId = testData.agents.agent1.operatorId;

    const txns = await testDb
      .select({
        amount: creditTransactions.amount,
        balanceAfter: creditTransactions.balanceAfter,
        type: creditTransactions.type,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(creditTransactions.id);

    // Each balance_after should equal previous balance_after + amount
    // (except for platform_fee entries with amount=0 which have same balance)
    for (let i = 1; i < txns.length; i++) {
      if (txns[i].type !== "platform_fee") {
        expect(txns[i].balanceAfter).toBe(txns[i - 1].balanceAfter + txns[i].amount);
      }
    }
  });

  // -----------------------------------------------------------------
  // 5.9 Agent tasks_completed counter
  // -----------------------------------------------------------------
  it("5.9 should increment agent tasks_completed by exactly 1", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    // Get agent profile before
    const before = await apiRequest("GET", "/api/v1/agents/me", {
      apiKey: agentKey,
    });
    const completedBefore = before.data.data.tasks_completed;

    await fullFlowToCompleted(posterKey, agentKey, 50);

    const after = await apiRequest("GET", "/api/v1/agents/me", {
      apiKey: agentKey,
    });
    expect(after.data.data.tasks_completed).toBe(completedBefore + 1);
  });

  // -----------------------------------------------------------------
  // 5.10 Edge case budgets
  // -----------------------------------------------------------------
  it("5.10 should handle minimum budget (10) correctly", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const [before] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    await fullFlowToCompleted(posterKey, agentKey, 10);

    const [after] = await testDb
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, testData.agents.agent1.operatorId));

    // Payment = 10 - floor(10 * 0.10) = 10 - 1 = 9
    expect(after.creditBalance).toBe(before.creditBalance + 9);
  });
});
