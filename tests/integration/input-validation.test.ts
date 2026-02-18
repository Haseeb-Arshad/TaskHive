import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  createTask,
  claimTask,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
});


describe("Input Validation & Boundary Testing", () => {
  // =================================================================
  // Task Creation Boundaries
  // =================================================================
  describe("Task Creation", () => {
    it("3.1 should reject budget below minimum (9)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 9,
      });
      expect(res.status).toBe(422);
      expect(res.data.ok).toBe(false);
    });

    it("3.2 should reject title too short (4 chars)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        title: "Hi!!",
      });
      expect(res.status).toBe(422);
    });

    it("3.3 should reject title too long (>200 chars)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        title: "A".repeat(201),
      });
      expect(res.status).toBe(422);
    });

    it("3.4 should reject description too short (<20 chars)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        description: "Short",
      });
      expect(res.status).toBe(422);
    });

    it("3.5 should accept budget exactly at minimum (10)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 10,
      });
      expect(res.status).toBe(201);
    });

    it("3.6 should reject budget at 9 (boundary)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 9,
      });
      expect(res.status).toBe(422);
    });

    it("3.7 should reject non-integer budget (10.5)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 10.5,
      });
      expect(res.status).toBe(422);
    });

    it("3.8 should reject negative budget (-50)", async () => {
      const res = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: -50,
      });
      expect(res.status).toBe(422);
    });
  });

  // =================================================================
  // Claim Validation
  // =================================================================
  describe("Claim Validation", () => {
    let taskId: number;

    beforeAll(async () => {
      const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, {
        budget_credits: 100,
      });
      taskId = taskRes.data.data.id;
    });

    it("3.9 should reject proposed_credits exceeding budget (422)", async () => {
      const res = await claimTask(testData.agents.agent1.rawApiKey, taskId, 101);
      expect(res.status).toBe(422);
      expect(res.data.error.code).toBe("INVALID_CREDITS");
    });

    it("3.10 should accept proposed_credits equal to budget", async () => {
      const res = await claimTask(testData.agents.agent1.rawApiKey, taskId, 100);
      expect(res.status).toBe(201);
    });

    it("3.11 should reject proposed_credits of zero", async () => {
      const res = await claimTask(testData.agents.agent2.rawApiKey, taskId, 0);
      expect(res.status).toBe(422);
    });
  });

  // =================================================================
  // PATCH /agents/me Validation (BUG: no Zod schema)
  // =================================================================
  describe("PATCH /agents/me Validation", () => {
    it("3.12a should reject non-string capabilities array items", async () => {
      const res = await apiRequest("PATCH", "/api/v1/agents/me", {
        body: { capabilities: [123, null, { nested: true }] },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      // BUG: Currently accepts array with non-string items
      expect(res.status).toBe(422);
    });

    it("3.12b should reject empty string name", async () => {
      const res = await apiRequest("PATCH", "/api/v1/agents/me", {
        body: { name: "" },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      // BUG: Currently accepts empty name
      expect(res.status).toBe(422);
    });

    it("3.12c should reject extremely long description (100K chars)", async () => {
      const res = await apiRequest("PATCH", "/api/v1/agents/me", {
        body: { description: "x".repeat(100000) },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      // BUG: Currently accepts unlimited length
      expect(res.status).toBe(422);
    });

    it("3.12d should reject invalid webhook_url", async () => {
      const res = await apiRequest("PATCH", "/api/v1/agents/me", {
        body: { webhook_url: "not-a-url" },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      // BUG: Currently accepts invalid URL
      expect(res.status).toBe(422);
    });

    it("3.12e should reject negative hourly_rate_credits", async () => {
      const res = await apiRequest("PATCH", "/api/v1/agents/me", {
        body: { hourly_rate_credits: -50 },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      // BUG: Currently accepts negative rate
      expect(res.status).toBe(422);
    });

    it("3.12f should use error envelope on invalid JSON", async () => {
      const res = await fetch(
        `http://localhost:3000/api/v1/agents/me`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testData.agents.agent1.rawApiKey}`,
          },
          body: "not json{{{",
        }
      );
      const data = await res.json();
      // BUG: Currently uses successResponse for errors (ok: true with status 400)
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =================================================================
  // ID Validation
  // =================================================================
  describe("ID Validation", () => {
    it("3.13 should reject non-numeric task ID", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks/abc", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
      expect(res.data.error.code).toBe("INVALID_PARAMETER");
    });

    it("3.14 should reject task ID of zero", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks/0", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
    });

    it("3.15 should reject negative task ID", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks/-5", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // JSON Body Validation
  // =================================================================
  describe("JSON Body", () => {
    it("3.16 should reject invalid JSON body on POST /tasks", async () => {
      const res = await fetch(
        `http://localhost:3000/api/v1/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testData.agents.posterAgent.rawApiKey}`,
          },
          body: "not json at all",
        }
      );
      const data = await res.json();
      expect(res.status).toBe(422);
      expect(data.ok).toBe(false);
    });
  });

  // =================================================================
  // Deliverable Content Validation
  // =================================================================
  describe("Deliverable Content", () => {
    it("3.17 should reject empty deliverable content", async () => {
      // Need a task in claimed state
      const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, { budget_credits: 50 });
      const taskId = taskRes.data.data.id;
      const claimRes = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
      const claimId = claimRes.data.data.id;
      await apiRequest("POST", `/api/v1/tasks/${taskId}/claims/accept`, {
        body: { claim_id: claimId },
        apiKey: testData.agents.posterAgent.rawApiKey,
      });

      const res = await apiRequest("POST", `/api/v1/tasks/${taskId}/deliverables`, {
        body: { content: "" },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });

    it("3.18 should reject deliverable content over 50000 chars", async () => {
      const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, { budget_credits: 50 });
      const taskId = taskRes.data.data.id;
      const claimRes = await claimTask(testData.agents.agent1.rawApiKey, taskId, 30);
      await apiRequest("POST", `/api/v1/tasks/${taskId}/claims/accept`, {
        body: { claim_id: claimRes.data.data.id },
        apiKey: testData.agents.posterAgent.rawApiKey,
      });

      const res = await apiRequest("POST", `/api/v1/tasks/${taskId}/deliverables`, {
        body: { content: "x".repeat(50001) },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });

    it("3.19 should reject claim message over 1000 chars", async () => {
      const taskRes = await createTask(testData.agents.posterAgent.rawApiKey, { budget_credits: 50 });
      const taskId = taskRes.data.data.id;

      const res = await claimTask(
        testData.agents.agent1.rawApiKey,
        taskId,
        30,
        "x".repeat(1001)
      );
      expect(res.status).toBe(422);
    });
  });

  // =================================================================
  // Webhook Validation
  // =================================================================
  describe("Webhook Validation", () => {
    it("3.20 should reject non-HTTPS webhook URL", async () => {
      const res = await apiRequest("POST", "/api/v1/webhooks", {
        body: { url: "http://example.com/hook", events: ["task.new_match"] },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });

    it("3.21 should reject invalid webhook event type", async () => {
      const res = await apiRequest("POST", "/api/v1/webhooks", {
        body: { url: "https://example.com/hook", events: ["invalid.event"] },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });

    it("3.22 should reject empty events array", async () => {
      const res = await apiRequest("POST", "/api/v1/webhooks", {
        body: { url: "https://example.com/hook", events: [] },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });
  });

  // =================================================================
  // Bulk Claims Validation
  // =================================================================
  describe("Bulk Claims", () => {
    it("3.23 should reject bulk claims with more than 10 items", async () => {
      const claims = Array.from({ length: 11 }, (_, i) => ({
        task_id: i + 1,
        proposed_credits: 10,
      }));
      const res = await apiRequest("POST", "/api/v1/tasks/bulk/claims", {
        body: { claims },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });

    it("3.24 should reject empty claims array", async () => {
      const res = await apiRequest("POST", "/api/v1/tasks/bulk/claims", {
        body: { claims: [] },
        apiKey: testData.agents.agent1.rawApiKey,
      });
      expect(res.status).toBe(422);
    });
  });

  // =================================================================
  // Browse Tasks Validation
  // =================================================================
  describe("Browse Tasks", () => {
    it("3.25 should reject invalid sort parameter", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks?sort=invalid", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
    });

    it("3.26a should reject limit of 0", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks?limit=0", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
    });

    it("3.26b should reject limit over 100", async () => {
      const res = await apiRequest("GET", "/api/v1/tasks?limit=101", {
        apiKey: testData.agents.posterAgent.rawApiKey,
      });
      expect(res.status).toBe(400);
    });
  });
});
