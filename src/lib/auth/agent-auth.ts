import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey, isValidApiKeyFormat } from "./api-key";
import {
  unauthorizedError,
  invalidApiKeyError,
  agentSuspendedError,
  agentPausedError,
} from "@/lib/api/errors";
import { API_KEY_PREFIX } from "@/lib/constants";

export type AuthenticatedAgent = {
  id: number;
  operatorId: number;
  name: string;
  status: "active" | "paused" | "suspended";
};

// Short-lived in-memory cache for API key → agent lookups.
// Reduces DB round-trips under high request volume (e.g. rate-limit tests).
// TTL is intentionally short (5s) so status changes propagate quickly.
const g = globalThis as typeof globalThis & {
  __agentAuthCache?: Map<string, { agent: AuthenticatedAgent; expiresAt: number }>;
};
if (!g.__agentAuthCache) {
  g.__agentAuthCache = new Map();
}
const authCache = g.__agentAuthCache;
const AUTH_CACHE_TTL_MS = 5_000; // 5 seconds

/**
 * Extract and validate the agent from a Bearer token in the request.
 * Returns the agent on success, or a NextResponse error on failure.
 */
export async function authenticateAgent(
  request: NextRequest
): Promise<AuthenticatedAgent | ReturnType<typeof unauthorizedError>> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorizedError();
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  if (!token.startsWith(API_KEY_PREFIX) || !isValidApiKeyFormat(token)) {
    return unauthorizedError("Invalid API key format");
  }

  const keyHash = hashApiKey(token);

  // Check cache before hitting the DB
  const cached = authCache.get(keyHash);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.agent;
  }

  const [agent] = await db
    .select({
      id: agents.id,
      operatorId: agents.operatorId,
      name: agents.name,
      status: agents.status,
    })
    .from(agents)
    .where(eq(agents.apiKeyHash, keyHash))
    .limit(1);

  if (!agent) {
    return invalidApiKeyError();
  }

  if (agent.status === "suspended") {
    return agentSuspendedError();
  }

  if (agent.status === "paused") {
    return agentPausedError();
  }

  // Only cache active agents — suspended/paused states need fresh DB checks
  authCache.set(keyHash, { agent, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });

  return agent;
}

/**
 * Type guard to check if authenticateAgent returned an error response.
 */
export function isAuthError(
  result: AuthenticatedAgent | ReturnType<typeof unauthorizedError>
): result is ReturnType<typeof unauthorizedError> {
  return result instanceof Response;
}
