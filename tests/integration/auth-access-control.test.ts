import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  createTask,
  claimTask,
  acceptClaim,
  submitDeliverable,
  fullFlowToDelivered,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
});


describe("Authorization & Access Control", () => {
  // -----------------------------------------------------------------
  // 1.1 Missing Authorization header
  // -----------------------------------------------------------------
  it("1.1 should reject requests without Authorization header (401)", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks");
    expect(res.status).toBe(401);
    expect(res.data.ok).toBe(false);
    expect(res.data.error.code).toBe("UNAUTHORIZED");
    expect(res.data.error.suggestion).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // 1.2 Invalid Bearer token format
  // -----------------------------------------------------------------
  it("1.2 should reject invalid Bearer token format (401)", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: "invalid_token_here",
    });
    expect(res.status).toBe(401);
    expect(res.data.ok).toBe(false);
    expect(res.data.error.code).toBe("UNAUTHORIZED");
  });

  // -----------------------------------------------------------------
  // 1.3 Well-formatted but nonexistent API key
  // -----------------------------------------------------------------
  it("1.3 should reject nonexistent but valid-format API key (401)", async () => {
    const fakeKey = "th_agent_" + "a".repeat(64);
    const res = await apiRequest("GET", "/api/v1/tasks", { apiKey: fakeKey });
    expect(res.status).toBe(401);
    expect(res.data.ok).toBe(false);
    expect(res.data.error.code).toBe("UNAUTHORIZED");
  });

  // -----------------------------------------------------------------
  // 1.4 Suspended agent blocked
  // -----------------------------------------------------------------
  it("1.4 should block suspended agents (403)", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.suspendedAgent.rawApiKey,
    });
    expect(res.status).toBe(403);
    expect(res.data.ok).toBe(false);
    expect(res.data.error.code).toBe("FORBIDDEN");
    expect(res.data.error.message).toContain("suspended");
  });

  // -----------------------------------------------------------------
  // 1.5 Paused agent blocked
  // -----------------------------------------------------------------
  it("1.5 should block paused agents (403)", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.pausedAgent.rawApiKey,
    });
    expect(res.status).toBe(403);
    expect(res.data.ok).toBe(false);
    expect(res.data.error.code).toBe("FORBIDDEN");
    expect(res.data.error.message).toContain("paused");
  });

  // -----------------------------------------------------------------
  // 1.6 CRITICAL: Claim accept - no poster ownership check
  // -----------------------------------------------------------------
  it("1.6 should reject claim accept from non-poster agent (403)", async () => {
    // Poster agent creates task
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;

    // Agent1 claims the task
    const claimRes = await claimTask(
      testData.agents.agent1.rawApiKey,
      taskId,
      30
    );
    const claimId = claimRes.data.data.id;

    // Agent2 (NOT the poster) tries to accept the claim — should be 403
    const acceptRes = await acceptClaim(
      testData.agents.agent2.rawApiKey,
      taskId,
      claimId
    );

    expect(acceptRes.status).toBe(403);
    expect(acceptRes.data.ok).toBe(false);
    expect(acceptRes.data.error.code).toBe("FORBIDDEN");
  });

  // -----------------------------------------------------------------
  // 1.7 CRITICAL: Deliverable accept - no poster ownership check
  // -----------------------------------------------------------------
  it("1.7 should reject deliverable accept from non-poster agent (403)", async () => {
    const { taskId, deliverableId } = await fullFlowToDelivered(
      testData.agents.posterAgent.rawApiKey,
      testData.agents.agent1.rawApiKey,
      60
    );

    // Agent2 (NOT the poster) tries to accept the deliverable
    const acceptRes = await apiRequest(
      "POST",
      `/api/v1/tasks/${taskId}/deliverables/accept`,
      {
        body: { deliverable_id: deliverableId },
        apiKey: testData.agents.agent2.rawApiKey,
      }
    );

    expect(acceptRes.status).toBe(403);
    expect(acceptRes.data.ok).toBe(false);
    expect(acceptRes.data.error.code).toBe("FORBIDDEN");
  });

  // -----------------------------------------------------------------
  // 1.8 CRITICAL: Revision request - no poster ownership check
  // -----------------------------------------------------------------
  it("1.8 should reject revision request from non-poster agent (403)", async () => {
    const { taskId, deliverableId } = await fullFlowToDelivered(
      testData.agents.posterAgent.rawApiKey,
      testData.agents.agent1.rawApiKey,
      60
    );

    // Agent2 (NOT the poster) tries to request revision
    const revRes = await apiRequest(
      "POST",
      `/api/v1/tasks/${taskId}/deliverables/revision`,
      {
        body: { deliverable_id: deliverableId, revision_notes: "Fix it" },
        apiKey: testData.agents.agent2.rawApiKey,
      }
    );

    expect(revRes.status).toBe(403);
    expect(revRes.data.ok).toBe(false);
    expect(revRes.data.error.code).toBe("FORBIDDEN");
  });

  // -----------------------------------------------------------------
  // 1.9 Rollback correctly checks poster ownership
  // -----------------------------------------------------------------
  it("1.9 should reject rollback from non-poster agent (403)", async () => {
    // Poster creates task, agent1 claims, poster accepts
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
    const claimId = claimRes.data.data.id;
    await acceptClaim(testData.agents.posterAgent.rawApiKey, taskId, claimId);

    // Agent2 tries to rollback
    const rollbackRes = await apiRequest(
      "POST",
      `/api/v1/tasks/${taskId}/rollback`,
      { apiKey: testData.agents.agent2.rawApiKey }
    );

    expect(rollbackRes.status).toBe(403);
    expect(rollbackRes.data.ok).toBe(false);
    expect(rollbackRes.data.error.code).toBe("FORBIDDEN");
  });

  // -----------------------------------------------------------------
  // 1.10 Webhook delete ownership check
  // -----------------------------------------------------------------
  it("1.10 should reject webhook delete from non-owner agent (403)", async () => {
    // Agent1 creates a webhook
    const createRes = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://example.com/test-hook-auth",
        events: ["task.new_match"],
      },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(createRes.status).toBe(201);
    const webhookId = createRes.data.data.id;

    // Agent2 tries to delete it
    const deleteRes = await apiRequest(
      "DELETE",
      `/api/v1/webhooks/${webhookId}`,
      { apiKey: testData.agents.agent2.rawApiKey }
    );

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.data.ok).toBe(false);
    expect(deleteRes.data.error.code).toBe("FORBIDDEN");
  });

  // -----------------------------------------------------------------
  // 1.11 Only claiming agent can submit deliverable
  // -----------------------------------------------------------------
  it("1.11 should reject deliverable from non-claiming agent (403)", async () => {
    // Poster creates task, agent1 claims, poster accepts
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;
    const claimRes = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
    const claimId = claimRes.data.data.id;
    await acceptClaim(testData.agents.posterAgent.rawApiKey, taskId, claimId);

    // Agent2 tries to submit deliverable (not the claiming agent)
    const delRes = await submitDeliverable(
      testData.agents.agent2.rawApiKey,
      taskId,
      "Here is my fake deliverable content that should be rejected."
    );

    expect(delRes.status).toBe(403);
    expect(delRes.data.ok).toBe(false);
  });
});
