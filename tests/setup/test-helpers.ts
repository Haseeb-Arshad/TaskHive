/**
 * Shared test helpers for TaskHive integration tests.
 * Provides API client, factories, and DB access for test setup/teardown.
 */
import crypto from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// -------------------------------------------------------------------
// Database connection (direct, bypasses the app)
// -------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL!;
const pgSql = postgres(connectionString, { prepare: false });
export const testDb = drizzle(pgSql, { schema });

// -------------------------------------------------------------------
// Base URL for the running dev server
// -------------------------------------------------------------------
export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// -------------------------------------------------------------------
// API request helper
// -------------------------------------------------------------------
export interface ApiRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  apiKey?: string;
}

export async function apiRequest(
  method: string,
  path: string,
  options: ApiRequestOptions = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, fetchOptions);

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

// -------------------------------------------------------------------
// API Key generation (same logic as the app)
// -------------------------------------------------------------------
function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Buffer.from(bytes).toString("hex");
  const rawKey = `th_agent_${hex}`;
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.substring(0, 14);
  return { rawKey, hash, prefix };
}

// -------------------------------------------------------------------
// Test data store (populated by global setup)
// -------------------------------------------------------------------
export interface TestUser {
  id: number;
  email: string;
  name: string;
}

export interface TestAgent {
  id: number;
  operatorId: number;
  name: string;
  rawApiKey: string;
  status: string;
}

export const testData: {
  users: { poster: TestUser; operator1: TestUser; operator2: TestUser };
  agents: {
    posterAgent: TestAgent;
    agent1: TestAgent;
    agent2: TestAgent;
    suspendedAgent: TestAgent;
    pausedAgent: TestAgent;
  };
  categoryIds: number[];
} = {} as any;

// -------------------------------------------------------------------
// Setup: Create test users and agents directly in DB
// -------------------------------------------------------------------
export async function setupTestData(retries = 3): Promise<void> {
  try {
    await _setupTestDataOnce();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 2000));
      return setupTestData(retries - 1);
    }
    throw err;
  }
}

async function _setupTestDataOnce() {
  const passwordHash = await bcrypt.hash("TestPass123!", 12);

  // Create 3 users
  const [poster] = await testDb
    .insert(schema.users)
    .values({
      email: `poster_${Date.now()}@test.com`,
      passwordHash,
      name: "Test Poster",
      creditBalance: 1000,
      role: "poster",
    })
    .returning();

  const [operator1] = await testDb
    .insert(schema.users)
    .values({
      email: `op1_${Date.now()}@test.com`,
      passwordHash,
      name: "Test Operator 1",
      creditBalance: 600,
      role: "operator",
    })
    .returning();

  const [operator2] = await testDb
    .insert(schema.users)
    .values({
      email: `op2_${Date.now()}@test.com`,
      passwordHash,
      name: "Test Operator 2",
      creditBalance: 600,
      role: "operator",
    })
    .returning();

  // Create agents with API keys
  const posterKey = generateApiKey();
  const [posterAgent] = await testDb
    .insert(schema.agents)
    .values({
      operatorId: poster.id,
      name: "Poster Agent",
      description: "Agent for the poster",
      apiKeyHash: posterKey.hash,
      apiKeyPrefix: posterKey.prefix,
      status: "active",
      capabilities: ["general"],
      categoryIds: [1],
    })
    .returning();

  const key1 = generateApiKey();
  const [agent1] = await testDb
    .insert(schema.agents)
    .values({
      operatorId: operator1.id,
      name: "Test Agent 1",
      description: "Agent for operator 1",
      apiKeyHash: key1.hash,
      apiKeyPrefix: key1.prefix,
      status: "active",
      capabilities: ["coding", "writing"],
      categoryIds: [1, 2],
    })
    .returning();

  const key2 = generateApiKey();
  const [agent2] = await testDb
    .insert(schema.agents)
    .values({
      operatorId: operator2.id,
      name: "Test Agent 2",
      description: "Agent for operator 2",
      apiKeyHash: key2.hash,
      apiKeyPrefix: key2.prefix,
      status: "active",
      capabilities: ["research"],
      categoryIds: [3],
    })
    .returning();

  const suspKey = generateApiKey();
  const [suspendedAgent] = await testDb
    .insert(schema.agents)
    .values({
      operatorId: operator1.id,
      name: "Suspended Agent",
      description: "A suspended agent",
      apiKeyHash: suspKey.hash,
      apiKeyPrefix: suspKey.prefix,
      status: "suspended",
      capabilities: [],
      categoryIds: [],
    })
    .returning();

  const pauseKey = generateApiKey();
  const [pausedAgent] = await testDb
    .insert(schema.agents)
    .values({
      operatorId: operator1.id,
      name: "Paused Agent",
      description: "A paused agent",
      apiKeyHash: pauseKey.hash,
      apiKeyPrefix: pauseKey.prefix,
      status: "paused",
      capabilities: [],
      categoryIds: [],
    })
    .returning();

  // Fetch category IDs
  const cats = await testDb.select({ id: schema.categories.id }).from(schema.categories);

  testData.users = {
    poster: { id: poster.id, email: poster.email, name: poster.name },
    operator1: { id: operator1.id, email: operator1.email, name: operator1.name },
    operator2: { id: operator2.id, email: operator2.email, name: operator2.name },
  };

  testData.agents = {
    posterAgent: { id: posterAgent.id, operatorId: poster.id, name: posterAgent.name, rawApiKey: posterKey.rawKey, status: "active" },
    agent1: { id: agent1.id, operatorId: operator1.id, name: agent1.name, rawApiKey: key1.rawKey, status: "active" },
    agent2: { id: agent2.id, operatorId: operator2.id, name: agent2.name, rawApiKey: key2.rawKey, status: "active" },
    suspendedAgent: { id: suspendedAgent.id, operatorId: operator1.id, name: suspendedAgent.name, rawApiKey: suspKey.rawKey, status: "suspended" },
    pausedAgent: { id: pausedAgent.id, operatorId: operator1.id, name: pausedAgent.name, rawApiKey: pauseKey.rawKey, status: "paused" },
  };

  testData.categoryIds = cats.map((c) => c.id);
}

// -------------------------------------------------------------------
// Factory helpers (via API)
// -------------------------------------------------------------------
export async function createTask(
  apiKey: string,
  overrides: Record<string, unknown> = {}
) {
  const body = {
    title: "Test Task " + Date.now(),
    description: "This is a test task description that is long enough to pass validation.",
    budget_credits: 100,
    category_id: testData.categoryIds[0] || 1,
    max_revisions: 2,
    ...overrides,
  };
  const res = await apiRequest("POST", "/api/v1/tasks", { body, apiKey });
  return res;
}

export async function claimTask(
  apiKey: string,
  taskId: number,
  proposedCredits: number = 50,
  message: string = "I can do this"
) {
  return apiRequest("POST", `/api/v1/tasks/${taskId}/claims`, {
    body: { proposed_credits: proposedCredits, message },
    apiKey,
  });
}

export async function acceptClaim(
  apiKey: string,
  taskId: number,
  claimId: number
) {
  return apiRequest("POST", `/api/v1/tasks/${taskId}/claims/accept`, {
    body: { claim_id: claimId },
    apiKey,
  });
}

export async function submitDeliverable(
  apiKey: string,
  taskId: number,
  content: string = "Here is the completed work with sufficient content for the test."
) {
  return apiRequest("POST", `/api/v1/tasks/${taskId}/deliverables`, {
    body: { content },
    apiKey,
  });
}

export async function acceptDeliverable(
  apiKey: string,
  taskId: number,
  deliverableId: number
) {
  return apiRequest("POST", `/api/v1/tasks/${taskId}/deliverables/accept`, {
    body: { deliverable_id: deliverableId },
    apiKey,
  });
}

export async function requestRevision(
  apiKey: string,
  taskId: number,
  deliverableId: number,
  revisionNotes: string = "Please improve this."
) {
  return apiRequest("POST", `/api/v1/tasks/${taskId}/deliverables/revision`, {
    body: { deliverable_id: deliverableId, revision_notes: revisionNotes },
    apiKey,
  });
}

/**
 * Drive a task through the full flow to "delivered" state.
 * posterKey creates task, agentKey claims, posterKey accepts claim, agentKey delivers.
 * Returns { taskId, claimId, deliverableId }.
 */
export async function fullFlowToDelivered(
  posterKey: string,
  agentKey: string,
  budget: number = 100
) {
  const taskRes = await createTask(posterKey, { budget_credits: budget });
  const taskId = taskRes.data.data.id;

  const claimRes = await claimTask(agentKey, taskId, Math.min(50, budget));
  const claimId = claimRes.data.data.id;

  await acceptClaim(posterKey, taskId, claimId);

  const delRes = await submitDeliverable(agentKey, taskId);
  const deliverableId = delRes.data.data.id;

  return { taskId, claimId, deliverableId };
}

/**
 * Drive a task through to "completed" state (includes credit distribution).
 */
export async function fullFlowToCompleted(
  posterKey: string,
  agentKey: string,
  budget: number = 100
) {
  const { taskId, claimId, deliverableId } = await fullFlowToDelivered(
    posterKey,
    agentKey,
    budget
  );
  await acceptDeliverable(posterKey, taskId, deliverableId);
  return { taskId, claimId, deliverableId };
}

// -------------------------------------------------------------------
// Cleanup
// -------------------------------------------------------------------
export async function closeDb() {
  await pgSql.end();
}
