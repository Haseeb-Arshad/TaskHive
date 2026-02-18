import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  createTask,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
  // Create 25 tasks with varying budgets for pagination tests
  const posterKey = testData.agents.posterAgent.rawApiKey;
  for (let i = 0; i < 25; i++) {
    await createTask(posterKey, {
      budget_credits: 10 + i * 10,
      title: `Pagination Task ${i + 1} ${Date.now()}`,
    });
  }
});


describe("Pagination & Cursor Handling", () => {
  it("6.1 should return default page size of 20", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeLessThanOrEqual(20);
    expect(res.data.meta.count).toBeLessThanOrEqual(20);
    if (res.data.data.length === 20) {
      expect(res.data.meta.has_more).toBe(true);
      expect(res.data.meta.cursor).toBeTruthy();
    }
  });

  it("6.2 should return page 2 with no overlap using cursor", async () => {
    const page1 = await apiRequest("GET", "/api/v1/tasks?limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(page1.status).toBe(200);
    const cursor = page1.data.meta.cursor;

    const page2 = await apiRequest("GET", `/api/v1/tasks?limit=5&cursor=${cursor}`, {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(page2.status).toBe(200);

    const page1Ids = page1.data.data.map((t: any) => t.id);
    const page2Ids = page2.data.data.map((t: any) => t.id);
    const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("6.3 should return has_more=false on last page", async () => {
    let cursor = undefined;
    let hasMore = true;
    let pages = 0;
    const apiKey = testData.agents.posterAgent.rawApiKey;

    while (hasMore && pages < 20) {
      const url = cursor ? `/api/v1/tasks?limit=100&cursor=${cursor}` : "/api/v1/tasks?limit=100";
      const res = await apiRequest("GET", url, { apiKey });
      hasMore = res.data.meta.has_more;
      cursor = res.data.meta.cursor;
      pages++;
    }

    expect(hasMore).toBe(false);
  });

  it("6.4 should respect custom limit", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeLessThanOrEqual(5);
  });

  it("6.5 should work with limit=1", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?limit=1", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBe(1);
  });

  it("6.6 should work with limit=100", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?limit=100", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeLessThanOrEqual(100);
  });

  it("6.7 should sort by budget_high with correct cursor", async () => {
    const page1 = await apiRequest("GET", "/api/v1/tasks?sort=budget_high&limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(page1.status).toBe(200);
    const budgets = page1.data.data.map((t: any) => t.budget_credits);
    // Should be in descending order
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1]);
    }

    if (page1.data.meta.cursor) {
      const page2 = await apiRequest(
        "GET",
        `/api/v1/tasks?sort=budget_high&limit=5&cursor=${page1.data.meta.cursor}`,
        { apiKey: testData.agents.posterAgent.rawApiKey }
      );
      const page2Budgets = page2.data.data.map((t: any) => t.budget_credits);
      // Page 2's first item should be <= page 1's last item
      if (page2Budgets.length > 0) {
        expect(page2Budgets[0]).toBeLessThanOrEqual(budgets[budgets.length - 1]);
      }
    }
  });

  it("6.8 should sort by budget_low ascending", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?sort=budget_low&limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    const budgets = res.data.data.map((t: any) => t.budget_credits);
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
    }
  });

  it("6.9 should sort by oldest (ascending ID)", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?sort=oldest&limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    const ids = res.data.data.map((t: any) => t.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });

  it("6.10 should reject malformed base64 cursor", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks?cursor=!!not-base64!!", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe("INVALID_PARAMETER");
  });

  it("6.11 should not crash with cursor from different sort order", async () => {
    const page1 = await apiRequest("GET", "/api/v1/tasks?sort=newest&limit=5", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    const cursor = page1.data.meta.cursor;
    if (cursor) {
      const res = await apiRequest(
        "GET",
        `/api/v1/tasks?sort=budget_high&limit=5&cursor=${cursor}`,
        { apiKey: testData.agents.posterAgent.rawApiKey }
      );
      // Should return 400 (incompatible cursor), not 500 crash
      expect(res.status).toBe(400);
      expect(res.data.error.code).toBe("INVALID_PARAMETER");
    }
  });

  it("6.12 should handle crafted cursor with nonexistent ID", async () => {
    const fakeCursor = Buffer.from(JSON.stringify({ id: 999999 })).toString("base64");
    const res = await apiRequest("GET", `/api/v1/tasks?cursor=${fakeCursor}`, {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    // Should return empty or valid data, not error
  });

  it("6.13 should paginate agent claims", async () => {
    const res = await apiRequest("GET", "/api/v1/agents/me/claims?limit=2", {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it("6.14 should paginate agent credits", async () => {
    const res = await apiRequest("GET", "/api/v1/agents/me/credits?limit=2", {
      apiKey: testData.agents.agent1.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
  });

  it("6.15 should combine filters and pagination", async () => {
    const res = await apiRequest(
      "GET",
      `/api/v1/tasks?status=open&min_budget=50&limit=5`,
      { apiKey: testData.agents.posterAgent.rawApiKey }
    );
    expect(res.status).toBe(200);
    for (const task of res.data.data) {
      expect(task.status).toBe("open");
      expect(task.budget_credits).toBeGreaterThanOrEqual(50);
    }
  });
});
