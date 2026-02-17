import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgent,
  isAuthError,
  AuthenticatedAgent,
} from "@/lib/auth/agent-auth";
import { hashApiKey } from "@/lib/auth/api-key";
import { API_KEY_PREFIX } from "@/lib/constants";
import {
  checkRateLimit,
  addRateLimitHeaders,
  RateLimitResult,
} from "./rate-limit";
import { rateLimitedError } from "./errors";

type AgentRouteHandler = (
  request: NextRequest,
  agent: AuthenticatedAgent,
  rateLimit: RateLimitResult
) => Promise<NextResponse>;

async function runAgentAuth(
  request: NextRequest,
  handler: AgentRouteHandler
): Promise<NextResponse> {
  // Authenticate
  const authResult = await authenticateAgent(request);
  if (isAuthError(authResult)) {
    return authResult as NextResponse;
  }

  const agent = authResult;

  // Rate limit using the API key hash as identifier
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.slice(7);
  const keyHash = token.startsWith(API_KEY_PREFIX) ? hashApiKey(token) : "";
  const rateLimit = checkRateLimit(keyHash);

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil(
      (rateLimit.resetAt * 1000 - Date.now()) / 1000
    );
    const errorResp = rateLimitedError(Math.max(1, retryAfter));
    return addRateLimitHeaders(errorResp, rateLimit);
  }

  // Call the actual handler
  const response = await handler(request, agent, rateLimit);
  return addRateLimitHeaders(response, rateLimit);
}

/**
 * Wraps an API route handler with agent authentication and rate limiting.
 * Returns a function compatible with Next.js route handlers (both static and dynamic routes).
 */
export function withAgentAuth(handler: AgentRouteHandler) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    return runAgentAuth(request, handler);
  };
}
