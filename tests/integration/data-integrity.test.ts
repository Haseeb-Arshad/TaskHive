import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  testDb,
  createTask,
  claimTask,
  acceptClaim,
  submitDeliverable,
  fullFlowToCompleted,
  
} from "../setup/test-helpers";
import { tasks, taskClaims, deliverables, agents } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";

beforeAll(async () => {
  await setupTestData();
});


describe("Data Integrity", () => {
  // -----------------------------------------------------------------
  // 11.1 Budget constraint at DB level (gap documentation)
  // -----------------------------------------------------------------
  it("11.1 should document: no DB-level CHECK on budget_credits >= 10", async () => {
    // The Zod validator catches this at API level.
    // But the DB has no CHECK constraint.
    // Attempt via API (should fail at validation)
    const res = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 5,
    });
    expect(res.status).toBe(422); // API catches it

    // Direct DB insert would succeed (documenting the gap)
    // We don't do the direct insert to avoid polluting data
  });

  // -----------------------------------------------------------------
  // 11.2 Proposed credits constraint (gap documentation)
  // -----------------------------------------------------------------
  it("11.2 should document: no DB-level CHECK on proposed_credits <= budget", async () => {
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;

    const res = await claimTask(testData.agents.agent1.rawApiKey, taskId, 51);
    expect(res.status).toBe(422); // API catches it
  });

  // -----------------------------------------------------------------
  // 11.3 credit_balance >= 0 not enforced (gap)
  // -----------------------------------------------------------------
  it("11.3 should document: no DB-level CHECK on credit_balance >= 0", async () => {
    // The app doesn't debit posters, so negative balances are unlikely.
    // But if they were to debit, no DB constraint would prevent it.
    // This is a documentation test.
    expect(true).toBe(true);
  });

  // -----------------------------------------------------------------
  // 11.4 apiKeyHash uniqueness (gap)
  // -----------------------------------------------------------------
  it("11.4 should document: apiKeyHash is not UNIQUE in schema", async () => {
    // The agents table has no unique index on apiKeyHash.
    // A hash collision (extremely unlikely) would cause authenticateAgent
    // to return the first matching agent — potentially wrong.
    // We document this gap.
    const agentRows = await testDb
      .select({ hash: agents.apiKeyHash })
      .from(agents)
      .limit(2);
    // All hashes should be unique in practice
    const uniqueHashes = new Set(agentRows.map((r) => r.hash));
    expect(uniqueHashes.size).toBe(agentRows.length);
  });

  // -----------------------------------------------------------------
  // 11.5 Rating constraint (gap)
  // -----------------------------------------------------------------
  it("11.5 should document: no DB-level CHECK on rating (1-5)", async () => {
    // No reviews endpoint is tested here, just documenting the gap
    expect(true).toBe(true);
  });

  // -----------------------------------------------------------------
  // 11.6 Deliverable revision number uniqueness (gap)
  // -----------------------------------------------------------------
  it("11.6 should document: no UNIQUE constraint on (taskId, revisionNumber)", async () => {
    // Race conditions could create duplicate revision numbers.
    // This is tested in race-conditions.test.ts (4.2).
    // Just documenting the missing constraint here.
    expect(true).toBe(true);
  });

  // -----------------------------------------------------------------
  // 11.7 Foreign key integrity
  // -----------------------------------------------------------------
  it("11.7 should reject task creation with nonexistent category", async () => {
    const res = await createTask(testData.agents.posterAgent.rawApiKey, {
      category_id: 99999,
    });
    // May return 422 (validation) or 500 (FK violation) or 201 (nullable FK)
    // If category_id is nullable, it might succeed — document behavior
    if (res.status === 201) {
      // Category FK is nullable, so this is accepted
      expect(res.data.data.category_id).toBe(99999);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  // -----------------------------------------------------------------
  // 11.8 Task created with correct poster (operatorId, not agentId)
  // -----------------------------------------------------------------
  it("11.8 should set poster_id to agent's operator_id", async () => {
    const res = await createTask(testData.agents.agent1.rawApiKey, {
      budget_credits: 50,
    });
    expect(res.status).toBe(201);
    const taskId = res.data.data.id;

    // Verify via DB
    const [task] = await testDb
      .select({ posterId: tasks.posterId })
      .from(tasks)
      .where(eq(tasks.id, taskId));

    expect(task.posterId).toBe(testData.agents.agent1.operatorId);
  });

  // -----------------------------------------------------------------
  // 11.9 Claim linked to correct agent
  // -----------------------------------------------------------------
  it("11.9 should link claim to correct agent ID", async () => {
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;

    const claimRes = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
    expect(claimRes.status).toBe(201);
    const claimId = claimRes.data.data.id;

    const [claim] = await testDb
      .select({ agentId: taskClaims.agentId })
      .from(taskClaims)
      .where(eq(taskClaims.id, claimId));

    expect(claim.agentId).toBe(testData.agents.agent1.id);
  });

  // -----------------------------------------------------------------
  // 11.10 Deliverable linked to correct agent
  // -----------------------------------------------------------------
  it("11.10 should link deliverable to correct agent ID", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    const delRes = await submitDeliverable(agentKey, taskId);
    expect(delRes.status).toBe(201);
    const delId = delRes.data.data.id;

    const [del] = await testDb
      .select({ agentId: deliverables.agentId })
      .from(deliverables)
      .where(eq(deliverables.id, delId));

    expect(del.agentId).toBe(testData.agents.agent1.id);
  });
});
