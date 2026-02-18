import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  createTask,
  claimTask,
  acceptClaim,
  submitDeliverable,
  acceptDeliverable,
  requestRevision,
  fullFlowToDelivered,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
});


describe("State Machine & Status Transitions", () => {
  // -----------------------------------------------------------------
  // 2.1 Complete happy path
  // -----------------------------------------------------------------
  it("2.1 should complete full lifecycle: open -> claimed -> delivered -> completed", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    // 1. Create task
    const taskRes = await createTask(posterKey, { budget_credits: 100 });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.data.data.id;
    expect(taskRes.data.data.status).toBe("open");

    // 2. Claim task
    const claimRes = await claimTask(agentKey, taskId, 50);
    expect(claimRes.status).toBe(201);
    expect(claimRes.data.data.status).toBe("pending");
    const claimId = claimRes.data.data.id;

    // 3. Accept claim
    const acceptClaimRes = await acceptClaim(posterKey, taskId, claimId);
    expect(acceptClaimRes.status).toBe(200);

    // Verify task is claimed
    const taskDetail1 = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskDetail1.data.data.status).toBe("claimed");

    // 4. Submit deliverable
    const delRes = await submitDeliverable(agentKey, taskId);
    expect(delRes.status).toBe(201);
    const deliverableId = delRes.data.data.id;

    // 5. Accept deliverable
    const acceptDelRes = await acceptDeliverable(posterKey, taskId, deliverableId);
    expect(acceptDelRes.status).toBe(200);

    // 6. Verify final state
    const taskFinal = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskFinal.data.data.status).toBe("completed");
  });

  // -----------------------------------------------------------------
  // 2.2 Revision path
  // -----------------------------------------------------------------
  it("2.2 should handle revision path: delivered -> in_progress -> delivered -> completed", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const { taskId, deliverableId } = await fullFlowToDelivered(posterKey, agentKey, 80);

    // Request revision
    const revRes = await requestRevision(posterKey, taskId, deliverableId);
    expect(revRes.status).toBe(200);

    // Verify task is in_progress
    const taskAfterRev = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskAfterRev.data.data.status).toBe("in_progress");

    // Resubmit deliverable
    const del2Res = await submitDeliverable(agentKey, taskId, "Improved deliverable with requested changes.");
    expect(del2Res.status).toBe(201);
    const del2Id = del2Res.data.data.id;
    expect(del2Res.data.data.revision_number).toBe(2);

    // Accept revised deliverable
    const acceptRes = await acceptDeliverable(posterKey, taskId, del2Id);
    expect(acceptRes.status).toBe(200);

    // Verify completed
    const taskFinal = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskFinal.data.data.status).toBe("completed");
  });

  // -----------------------------------------------------------------
  // 2.3 Max revisions enforcement
  // -----------------------------------------------------------------
  it("2.3 should enforce max revisions limit", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    // Create task with max_revisions: 1 (2 total submissions)
    const taskRes = await createTask(posterKey, { budget_credits: 50, max_revisions: 1 });
    const taskId = taskRes.data.data.id;

    // Claim and accept
    const claimRes = await claimTask(agentKey, taskId, 30);
    const claimId = claimRes.data.data.id;
    await acceptClaim(posterKey, taskId, claimId);

    // Submit #1
    const del1 = await submitDeliverable(agentKey, taskId, "First submission with enough content.");
    expect(del1.status).toBe(201);
    const del1Id = del1.data.data.id;

    // Request revision
    await requestRevision(posterKey, taskId, del1Id);

    // Submit #2 (last allowed)
    const del2 = await submitDeliverable(agentKey, taskId, "Second submission with enough content.");
    expect(del2.status).toBe(201);
    const del2Id = del2.data.data.id;

    // Request another revision — should check if this is valid
    const rev2 = await requestRevision(posterKey, taskId, del2Id);
    // With max_revisions=1, revisionNumber 2 >= maxRevisions + 1 = 2, so should fail
    expect(rev2.status).toBe(409);
    expect(rev2.data.error.code).toBe("MAX_REVISIONS");
  });

  // -----------------------------------------------------------------
  // 2.4 Cannot claim non-open task
  // -----------------------------------------------------------------
  it("2.4 should reject claim on non-open task (409)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;
    const agent2Key = testData.agents.agent2.rawApiKey;

    // Create and claim task
    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    // Try to claim it again with agent2
    const claim2 = await claimTask(agent2Key, taskId, 25);
    expect(claim2.status).toBe(409);
    expect(claim2.data.error.code).toBe("TASK_NOT_OPEN");
  });

  // -----------------------------------------------------------------
  // 2.5 Cannot deliver to open task
  // -----------------------------------------------------------------
  it("2.5 should reject deliverable on open task (409)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;

    const delRes = await submitDeliverable(agentKey, taskId);
    // Returns 403 (not the claiming agent) or 409 (invalid status)
    expect(delRes.status).toBeGreaterThanOrEqual(400);
    expect(delRes.status).toBeLessThan(500);
  });

  // -----------------------------------------------------------------
  // 2.6 Cannot accept deliverable on non-delivered task
  // -----------------------------------------------------------------
  it("2.6 should reject deliverable accept on claimed task (409)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    // Try accepting a non-existent deliverable on a claimed (not delivered) task
    const res = await acceptDeliverable(posterKey, taskId, 99999);
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe("INVALID_STATUS");
  });

  // -----------------------------------------------------------------
  // 2.7 Cannot request revision on non-delivered task
  // -----------------------------------------------------------------
  it("2.7 should reject revision on non-delivered task (409)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    const revRes = await requestRevision(posterKey, taskId, 99999);
    expect(revRes.status).toBe(409);
    expect(revRes.data.error.code).toBe("INVALID_STATUS");
  });

  // -----------------------------------------------------------------
  // 2.8 Rollback: claimed -> open
  // -----------------------------------------------------------------
  it("2.8 should rollback claimed task to open", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    // Rollback
    const rollbackRes = await apiRequest("POST", `/api/v1/tasks/${taskId}/rollback`, {
      apiKey: posterKey,
    });
    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.data.data.status).toBe("open");
    expect(rollbackRes.data.data.previous_status).toBe("claimed");

    // Verify task is open again
    const taskDetail = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskDetail.data.data.status).toBe("open");
    expect(taskDetail.data.data.claimed_by_agent_id).toBeNull();
  });

  // -----------------------------------------------------------------
  // 2.9 Cannot rollback non-claimed task
  // -----------------------------------------------------------------
  it("2.9 should reject rollback on open task (409)", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;

    const rollbackRes = await apiRequest("POST", `/api/v1/tasks/${taskId}/rollback`, {
      apiKey: posterKey,
    });
    expect(rollbackRes.status).toBe(409);
    expect(rollbackRes.data.error.code).toBe("TASK_NOT_CLAIMED");
  });

  // -----------------------------------------------------------------
  // 2.10 Accepting claim auto-rejects other pending claims
  // -----------------------------------------------------------------
  it("2.10 should auto-reject other pending claims when one is accepted", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agent1Key = testData.agents.agent1.rawApiKey;
    const agent2Key = testData.agents.agent2.rawApiKey;

    // Create task
    const taskRes = await createTask(posterKey, { budget_credits: 100 });
    const taskId = taskRes.data.data.id;

    // Both agents claim
    const claim1 = await claimTask(agent1Key, taskId, 50);
    const claim1Id = claim1.data.data.id;
    const claim2 = await claimTask(agent2Key, taskId, 60);

    // Accept agent1's claim
    await acceptClaim(posterKey, taskId, claim1Id);

    // Check agent2's claims — should have a rejected claim
    const agent2Claims = await apiRequest("GET", "/api/v1/agents/me/claims?status=rejected", {
      apiKey: agent2Key,
    });
    expect(agent2Claims.status).toBe(200);
    const rejectedForThisTask = agent2Claims.data.data.filter(
      (c: any) => c.task_id === taskId
    );
    expect(rejectedForThisTask.length).toBeGreaterThanOrEqual(1);
    expect(rejectedForThisTask[0].status).toBe("rejected");
  });

  // -----------------------------------------------------------------
  // 2.11 First delivery skips in_progress (claimed -> delivered)
  // -----------------------------------------------------------------
  it("2.11 should transition directly from claimed to delivered on first submission", async () => {
    const posterKey = testData.agents.posterAgent.rawApiKey;
    const agentKey = testData.agents.agent1.rawApiKey;

    const taskRes = await createTask(posterKey, { budget_credits: 50 });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(agentKey, taskId, 30);
    await acceptClaim(posterKey, taskId, claimRes.data.data.id);

    // Submit deliverable
    await submitDeliverable(agentKey, taskId);

    // Verify it went straight to delivered (not in_progress)
    const taskDetail = await apiRequest("GET", `/api/v1/tasks/${taskId}`, { apiKey: posterKey });
    expect(taskDetail.data.data.status).toBe("delivered");
  });
});
