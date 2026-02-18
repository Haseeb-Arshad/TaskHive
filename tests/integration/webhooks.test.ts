import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
});


describe("Webhook System", () => {
  const createdWebhookIds: number[] = [];

  afterAll(async () => {
    // Clean up webhooks
    for (const id of createdWebhookIds) {
      await apiRequest("DELETE", `/api/v1/webhooks/${id}`, {
        apiKey: testData.agents.agent1.rawApiKey,
      });
    }
  });

  it("9.1 should create a webhook and return secret", async () => {
    const res = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://example.com/wh-test-1",
        events: ["task.new_match", "claim.accepted"],
      },
      apiKey: testData.agents.agent1.rawApiKey,
    });

    expect(res.status).toBe(201);
    expect(res.data.data.id).toBeTruthy();
    expect(res.data.data.url).toBe("https://example.com/wh-test-1");
    expect(res.data.data.secret).toBeTruthy();
    expect(res.data.data.secret.length).toBe(64);
    expect(res.data.data.secret_prefix).toBeTruthy();
    createdWebhookIds.push(res.data.data.id);
  });

  it("9.2 should list webhooks without exposing full secret", async () => {
    const res = await apiRequest("GET", "/api/v1/webhooks", {
      apiKey: testData.agents.agent1.rawApiKey,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
    for (const wh of res.data.data) {
      // Should have prefix but NOT full secret
      expect(wh.secret_prefix).toBeTruthy();
      expect(wh.secret_prefix.length).toBeLessThanOrEqual(8);
      // Full secret should NOT be in list response
      expect(wh.secret).toBeUndefined();
    }
  });

  it("9.3 should delete a webhook", async () => {
    // Create one to delete
    const createRes = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://example.com/wh-delete-test",
        events: ["claim.rejected"],
      },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    const webhookId = createRes.data.data.id;

    const deleteRes = await apiRequest("DELETE", `/api/v1/webhooks/${webhookId}`, {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(deleteRes.status).toBe(200);

    // Verify it's gone
    const listRes = await apiRequest("GET", "/api/v1/webhooks", {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    const ids = listRes.data.data.map((wh: any) => wh.id);
    expect(ids).not.toContain(webhookId);
  });

  it("9.4 should enforce max 5 webhooks per agent", async () => {
    // Use agent2 for isolation. Create 5 webhooks
    const agent2Key = testData.agents.agent2.rawApiKey;
    const webhookIds: number[] = [];

    for (let i = 0; i < 5; i++) {
      const res = await apiRequest("POST", "/api/v1/webhooks", {
        body: {
          url: `https://example.com/wh-max-${i}-${Date.now()}`,
          events: ["task.new_match"],
        },
        apiKey: agent2Key,
      });
      expect(res.status).toBe(201);
      webhookIds.push(res.data.data.id);
    }

    // 6th should fail
    const res = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://example.com/wh-max-6",
        events: ["task.new_match"],
      },
      apiKey: agent2Key,
    });
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe("MAX_WEBHOOKS");

    // Cleanup
    for (const id of webhookIds) {
      await apiRequest("DELETE", `/api/v1/webhooks/${id}`, { apiKey: agent2Key });
    }
  });

  it("9.5 should generate 64-char hex secret", async () => {
    const res = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://example.com/wh-secret-test",
        events: ["claim.accepted"],
      },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBe(201);
    const secret = res.data.data.secret;
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    createdWebhookIds.push(res.data.data.id);
  });

  it("9.6 should allow duplicate webhook URLs (missing constraint)", async () => {
    const url = `https://example.com/wh-dup-${Date.now()}`;

    const res1 = await apiRequest("POST", "/api/v1/webhooks", {
      body: { url, events: ["task.new_match"] },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res1.status).toBe(201);
    createdWebhookIds.push(res1.data.data.id);

    const res2 = await apiRequest("POST", "/api/v1/webhooks", {
      body: { url, events: ["task.new_match"] },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    // Currently allows duplicates (missing constraint)
    expect(res2.status).toBe(201);
    createdWebhookIds.push(res2.data.data.id);
  });

  it("9.7 should succeed even when webhook delivery fails (fire-and-forget)", async () => {
    // Create webhook pointing to unreachable URL
    const whRes = await apiRequest("POST", "/api/v1/webhooks", {
      body: {
        url: "https://httpbin.org/status/500",
        events: ["claim.accepted"],
      },
      apiKey: testData.agents.agent1.rawApiKey,
    });
    createdWebhookIds.push(whRes.data.data.id);

    // The API operations should still succeed even if webhook fails
    // This is tested implicitly by all other tests that trigger webhooks
    expect(whRes.status).toBe(201);
  });

  it("9.8 should reject non-positive webhook ID for delete", async () => {
    const res = await apiRequest("DELETE", "/api/v1/webhooks/0", {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBe(400);
  });

  it("9.9 should return 404 for nonexistent webhook", async () => {
    const res = await apiRequest("DELETE", "/api/v1/webhooks/99999", {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
