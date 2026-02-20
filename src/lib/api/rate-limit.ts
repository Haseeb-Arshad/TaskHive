import { NextResponse } from "next/server";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Use globalThis so the store persists across Next.js hot module reloads in dev mode.
const g = globalThis as typeof globalThis & {
  __rateLimitStore?: Map<string, RateLimitEntry>;
  __rateLimitCleanupSet?: boolean;
};

if (!g.__rateLimitStore) {
  g.__rateLimitStore = new Map<string, RateLimitEntry>();
}

const store = g.__rateLimitStore;

// Register cleanup interval only once
if (!g.__rateLimitCleanupSet) {
  g.__rateLimitCleanupSet = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // unix timestamp in seconds
}

/**
 * Check rate limit for a given key (typically API key hash).
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetAtSeconds = Math.ceil(entry.resetAt / 1000);

  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    limit: RATE_LIMIT_MAX,
    remaining,
    resetAt: resetAtSeconds,
  };
}

/**
 * Add rate limit headers to a NextResponse.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetAt));
  return response;
}
