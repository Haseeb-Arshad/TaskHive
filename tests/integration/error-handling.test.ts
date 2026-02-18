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


describe("Error Handling & Edge Cases", () => {
  // -----------------------------------------------------------------
  // 10.1 Response envelope format on success
  // -----------------------------------------------------------------
  it("10.1 should return correct success envelope format", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.data).toBeDefined();
    expect(res.data.meta).toBeDefined();
    expect(res.data.meta.timestamp).toBeTruthy();
    expect(res.data.meta.request_id).toBeTruthy();
    expect(res.data.meta.request_id).toMatch(/^req_/);
  });

  // -----------------------------------------------------------------
  // 10.2 Response envelope format on error
  // -----------------------------------------------------------------
  it("10.2 should return correct error envelope format", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks/99999", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(404);
    expect(res.data.ok).toBe(false);
    expect(res.data.error).toBeDefined();
    expect(res.data.error.code).toBe("TASK_NOT_FOUND");
    expect(res.data.error.message).toBeTruthy();
    expect(res.data.error.suggestion).toBeTruthy();
    expect(res.data.meta).toBeDefined();
    expect(res.data.meta.timestamp).toBeTruthy();
    expect(res.data.meta.request_id).toMatch(/^req_/);
  });

  // -----------------------------------------------------------------
  // 10.3 Every error includes suggestion field
  // -----------------------------------------------------------------
  describe("All error codes include suggestion field", () => {
    it("401 UNAUTHORIZED has suggestion", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks");
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("403 FORBIDDEN (suspended) has suggestion", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks", {
        apiKey: testData.agents.suspendedAgent.rawApiKey,
      });
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("404 TASK_NOT_FOUND has suggestion", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks/99999", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("409 TASK_NOT_OPEN has suggestion", async () => {
      const posterKey = testData.agents.posterAgent.rawApiKey;
      const agentKey = testData.agents.agent1.rawApiKey;
      const taskRes = await createTask(posterKey, { budget_credits: 50 });
      const taskId = taskRes.data.data.id;
      const claimRes = await claimTask(agentKey, taskId, 30);
      await acceptClaim(posterKey, taskId, claimRes.data.data.id);

      const res = await claimTask(testData.agents.agent2.rawApiKey, taskId, 25);
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("409 DUPLICATE_CLAIM has suggestion", async () => {
      const posterKey = testData.agents.posterAgent.rawApiKey;
      const taskRes = await createTask(posterKey, { budget_credits: 50 });
      const taskId = taskRes.data.data.id;

      await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
      const res = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("422 VALIDATION_ERROR has suggestion", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 5,
      });
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("400 INVALID_PARAMETER has suggestion", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks/abc", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.data.error.suggestion).toBeTruthy();
    });

    it("400 IDEMPOTENCY_KEY_TOO_LONG has suggestion", async () => {
      const res = await apiRequest("POST", "/api/v1/tasks", {
        body: {
          title: "Key Test " + Date.now(),
          description: "A description long enough for validation purposes here.",
          budget_credits: 50,
        },
        apiKey: testData.agents.posterAgent.rawApiKey,
        headers: { "Idempotency-Key": "k".repeat(256) },
      });
      expect(res.data.error.suggestion).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------
  // 10.4 Non-existent task returns 404
  // -----------------------------------------------------------------
  it("10.4 should return 404 for nonexistent task", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks/99999", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(404);
    expect(res.data.error.code).toBe("TASK_NOT_FOUND");
  });

  // -----------------------------------------------------------------
  // 10.5 Non-existent agent returns 404
  // -----------------------------------------------------------------
  it("10.5 should return 404 for nonexistent agent", async () => {
    const res = await apiRequest("GET", "/api/v1/agents/99999", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(404);
  });

  // -----------------------------------------------------------------
  // 10.6 Claim non-existent task
  // -----------------------------------------------------------------
  it("10.6 should return 404 when claiming nonexistent task", async () => {
    const res = await claimTask(testData.agents.agent1.rawApiKey, 99999, 50);
    expect(res.status).toBe(404);
  });

  // -----------------------------------------------------------------
  // 10.7 Accept non-existent claim
  // -----------------------------------------------------------------
  it("10.7 should return error for nonexistent claim", async () => {
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;

    const res = await acceptClaim(testData.agents.posterAgent.rawApiKey, taskId, 99999);
    expect(res.status).toBe(409);
  });

  // -----------------------------------------------------------------
  // 10.8 Accept non-existent deliverable
  // -----------------------------------------------------------------
  it("10.8 should return error for nonexistent deliverable", async () => {
    const { taskId } = await fullFlowToDelivered(
      testData.agents.posterAgent.rawApiKey,
      testData.agents.agent1.rawApiKey
    );

    const res = await apiRequest(
      "POST",
      `/api/v1/tasks/${taskId}/deliverables/accept`,
      {
        body: { deliverable_id: 99999 },
        apiKey: testData.agents.posterAgent.rawApiKey,
      }
    );
    expect(res.status).toBe(409);
  });

  // -----------------------------------------------------------------
  // 10.9 Duplicate claim by same agent
  // -----------------------------------------------------------------
  it("10.9 should reject duplicate claim from same agent (409)", async () => {
    const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
      budget_credits: 50,
    });
    const taskId = taskRes.data.data.id;

    const claim1 = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
    expect(claim1.status).toBe(201);

    const claim2 = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
    expect(claim2.status).toBe(409);
    expect(claim2.data.error.code).toBe("DUPLICATE_CLAIM");
  });

  // -----------------------------------------------------------------
  // 10.10 Request IDs are unique
  // -----------------------------------------------------------------
  it("10.10 should generate unique request IDs", async () => {
    const apiKey = testData.agents.posterAgent.rawApiKey;
    const ids = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const res = await apiRequest("GET", "/api/v1/tasks?limit=1", { apiKey });
      ids.add(res.data.meta.request_id);
    }

    expect(ids.size).toBe(10);
  });

  // -----------------------------------------------------------------
  // 10.11 PATCH /agents/me error envelope inconsistency (BUG)
  // -----------------------------------------------------------------
  it("10.11 should use error envelope on PATCH invalid JSON", async () => {
    const res = await fetch("http://localhost:3000/api/v1/agents/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testData.agents.agent1.rawApiKey}`,
      },
      body: "not valid json{{{",
    });
    const data = await res.json();

    // BUG: Currently returns ok: true with status 400 using successResponse
    // Should use errorResponse with ok: false
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });

  // -----------------------------------------------------------------
  // 10.12 PATCH /agents/me with no matching fields
  // -----------------------------------------------------------------
  it("10.12 should return message when no fields match for update", async () => {
    const res = await apiRequest("PATCH", "/api/v1/agents/me", {
      body: { unknown_field: "value" },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data.message).toBeTruthy();
  });
});
