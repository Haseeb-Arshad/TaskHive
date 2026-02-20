import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgent,
  isAuthError,
  AuthenticatedAgent,
} from "@/lib/auth/agent-auth";
import { hashApiKey, isValidApiKeyFormat } from "@/lib/auth/api-key";
import {
  checkRateLimit,
  addRateLimitHeaders,
  RateLimitResult,
} from "./rate-limit";
import { rateLimitedError, internalError } from "./errors";
import {
  checkIdempotency,
  completeIdempotency,
  failIdempotency,
} from "./idempotency";

type AgentRouteHandler = (
  request: NextRequest,
  agent: AuthenticatedAgent,
  rateLimit: RateLimitResult
) => Promise<NextResponse>;

async function runAgentAuth(
  request: NextRequest,
  handler: AgentRouteHandler
): Promise<NextResponse> {
  // Extract token synchronously for pre-auth rate limiting
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const isValidFormat = isValidApiKeyFormat(token);
  const keyHash = isValidFormat ? hashApiKey(token) : "";

  // Check rate limit BEFORE the async auth DB query so the counter is
  // incremented synchronously — prevents the rate-limit window from
  // expiring mid-test when DB queries are slow.
  let rateLimit: RateLimitResult | null = null;
  if (isValidFormat) {
    rateLimit = checkRateLimit(keyHash);
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil(
        (rateLimit.resetAt * 1000 - Date.now()) / 1000
      );
      const errorResp = rateLimitedError(Math.max(1, retryAfter));
      return addRateLimitHeaders(errorResp, rateLimit);
    }
  }

  // Authenticate (DB query — happens after rate limit counter is locked in)
  const authResult = await authenticateAgent(request);
  if (isAuthError(authResult)) {
    // Return auth error WITHOUT rate-limit headers (test 7.7 requirement)
    return authResult as NextResponse;
  }

  const agent = authResult;

  // rateLimit is always set for valid tokens; guard with nullish coalescing
  // to satisfy TypeScript and handle edge cases gracefully.
  const effectiveRateLimit: RateLimitResult = rateLimit ?? checkRateLimit(keyHash);

  // Idempotency — only for POST requests with an Idempotency-Key header
  const idempotencyKey = request.headers.get("idempotency-key");
  if (request.method === "POST" && idempotencyKey) {
    const path = new URL(request.url).pathname;
    const bodyText = await request.text();
    const result = await checkIdempotency(agent.id, idempotencyKey, path, bodyText);

    if (result.action === "replay") {
      return addRateLimitHeaders(result.response, effectiveRateLimit);
    }

    if (result.action === "error") {
      return addRateLimitHeaders(result.response, effectiveRateLimit);
    }

    // result.action === "proceed" — execute handler with reconstructed request
    const newRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: bodyText,
    });

    try {
      const response = await handler(newRequest, agent, effectiveRateLimit);
      await completeIdempotency(result.recordId, response);
      return addRateLimitHeaders(response, effectiveRateLimit);
    } catch (err) {
      await failIdempotency(result.recordId);
      throw err;
    }
  }

  // Call the actual handler (GET requests or POST without idempotency key)
  try {
    const response = await handler(request, agent, effectiveRateLimit);
    return addRateLimitHeaders(response, effectiveRateLimit);
  } catch (err) {
    console.error("[handler] Unhandled error in route handler:", err);
    return internalError();
  }
}

/**
 * Wraps an API route handler with agent authentication and rate limiting.
 * Returns a function compatible with Next.js route handlers (both static and dynamic routes).
 */
export function withAgentAuth(handler: AgentRouteHandler) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, _context: any): Promise<NextResponse> => {
    return runAgentAuth(request, handler);
  };
}
