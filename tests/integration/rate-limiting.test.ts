import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiRequest,
  setupTestData,
  testData,
  
} from "../setup/test-helpers";

beforeAll(async () => {
  await setupTestData();
});


describe("Rate Limiting", () => {
  it("7.1 should include rate limit headers in response", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("100");
    expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
  });

  it("7.2 should decrement remaining counter", async () => {
    // Use agent2 to avoid interference from other tests
    const apiKey = testData.agents.agent2.rawApiKey;

    const res1 = await apiRequest("GET", "/api/v1/tasks", { apiKey });
    const remaining1 = parseInt(res1.headers.get("x-ratelimit-remaining") || "0");

    const res2 = await apiRequest("GET", "/api/v1/tasks", { apiKey });
    const remaining2 = parseInt(res2.headers.get("x-ratelimit-remaining") || "0");

    const res3 = await apiRequest("GET", "/api/v1/tasks", { apiKey });
    const remaining3 = parseInt(res3.headers.get("x-ratelimit-remaining") || "0");

    expect(remaining1).toBeGreaterThan(remaining2);
    expect(remaining2).toBeGreaterThan(remaining3);
  });

  it("7.3 should enforce rate limit at 101st request", async () => {
    // Use agent1's key and send requests in concurrent batches for speed
    const apiKey = testData.agents.agent1.rawApiKey;

    let hitLimit = false;

    // Send requests in batches of 10 concurrently
    for (let batch = 0; batch < 11 && !hitLimit; batch++) {
      const batchSize = 10;
      const results = await Promise.all(
        Array.from({ length: batchSize }, () =>
          apiRequest("GET", "/api/v1/tasks?limit=1", { apiKey })
        )
      );

      for (const res of results) {
        if (res.status === 429) {
          hitLimit = true;
          expect(res.data.error.code).toBe("RATE_LIMITED");
          expect(res.data.error.suggestion).toBeTruthy();
          break;
        }
      }
    }

    expect(hitLimit).toBe(true);
  }, 120000);

  it("7.4 should return proper rate limit error format", async () => {
    // After test 7.3, agent1 should be rate limited
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.agent1.rawApiKey,
    });

    if (res.status === 429) {
      expect(res.data.ok).toBe(false);
      expect(res.data.error.code).toBe("RATE_LIMITED");
      expect(res.data.error.message).toBeTruthy();
      expect(res.data.error.suggestion).toBeTruthy();
      expect(res.data.meta).toBeDefined();
      expect(res.data.meta.timestamp).toBeTruthy();
      expect(res.data.meta.request_id).toBeTruthy();
    }
  });

  it("7.5 should have separate limits per API key", async () => {
    // posterAgent should still have capacity (hasn't been hammered)
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    // If posterAgent wasn't used 100 times, should still be 200
    expect(res.status).toBe(200);
    const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "0");
    expect(remaining).toBeGreaterThan(0);
  });

  it("7.6 should have valid reset timestamp in future", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: testData.agents.posterAgent.rawApiKey,
    });
    const resetStr = res.headers.get("x-ratelimit-reset");
    expect(resetStr).toBeTruthy();
    const resetTimestamp = parseInt(resetStr!);
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Reset should be within 60 seconds from now
    expect(resetTimestamp).toBeGreaterThanOrEqual(nowSeconds);
    expect(resetTimestamp).toBeLessThanOrEqual(nowSeconds + 61);
  });

  it("7.7 should not include rate limit headers on auth failure", async () => {
    const res = await apiRequest("GET", "/api/v1/tasks", {
      apiKey: "invalid_key",
    });
    expect(res.status).toBe(401);
    // Auth fails before rate limiting, so no rate limit headers
    const remaining = res.headers.get("x-ratelimit-remaining");
    expect(remaining).toBeNull();
  });
});
