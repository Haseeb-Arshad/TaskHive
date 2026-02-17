import crypto from "crypto";
import { db } from "@/lib/db/client";
import { idempotencyKeys } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_TTL_MS,
  IDEMPOTENCY_LOCK_TIMEOUT_MS,
} from "@/lib/constants";
import {
  idempotencyKeyTooLongError,
  idempotencyKeyMismatchError,
  idempotencyKeyInFlightError,
} from "./errors";
import { NextResponse } from "next/server";

type IdempotencyResult =
  | { action: "replay"; response: NextResponse }
  | { action: "proceed"; recordId: number }
  | { action: "error"; response: NextResponse };

function hashBody(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

/**
 * Check whether an Idempotency-Key has been seen before.
 * Returns "replay" (cached response), "proceed" (new request), or "error".
 */
export async function checkIdempotency(
  agentId: number,
  key: string,
  path: string,
  body: string
): Promise<IdempotencyResult> {
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return { action: "error", response: idempotencyKeyTooLongError() };
  }

  const bodyHash = hashBody(body);
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS);

  // Clean up expired keys opportunistically (non-blocking)
  db.delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()))
    .execute()
    .catch(() => {});

  // Try to find existing record
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.agentId, agentId),
        eq(idempotencyKeys.idempotencyKey, key)
      )
    )
    .limit(1);

  if (existing) {
    // Validate path + body match
    if (existing.requestPath !== path || existing.requestBodyHash !== bodyHash) {
      return { action: "error", response: idempotencyKeyMismatchError() };
    }

    // If completed, replay the cached response
    if (existing.completedAt && existing.responseBody !== null) {
      const cachedBody = JSON.parse(existing.responseBody);
      const response = NextResponse.json(cachedBody, {
        status: existing.responseStatus || 200,
      });
      response.headers.set("X-Idempotency-Replayed", "true");
      return { action: "replay", response };
    }

    // If locked but not completed, check if lock is stale
    const lockAge = Date.now() - existing.lockedAt.getTime();
    if (lockAge < IDEMPOTENCY_LOCK_TIMEOUT_MS) {
      return { action: "error", response: idempotencyKeyInFlightError() };
    }

    // Stale lock — reclaim it
    await db
      .update(idempotencyKeys)
      .set({ lockedAt: new Date() })
      .where(eq(idempotencyKeys.id, existing.id));

    return { action: "proceed", recordId: existing.id };
  }

  // No existing record — insert a new lock
  const [record] = await db
    .insert(idempotencyKeys)
    .values({
      agentId,
      idempotencyKey: key,
      requestPath: path,
      requestBodyHash: bodyHash,
      expiresAt,
    })
    .returning({ id: idempotencyKeys.id });

  return { action: "proceed", recordId: record.id };
}

/**
 * Store the response after the handler succeeds.
 */
export async function completeIdempotency(
  recordId: number,
  response: NextResponse
): Promise<void> {
  const cloned = response.clone();
  const body = await cloned.json();
  await db
    .update(idempotencyKeys)
    .set({
      responseStatus: response.status,
      responseBody: JSON.stringify(body),
      completedAt: new Date(),
    })
    .where(eq(idempotencyKeys.id, recordId));
}

/**
 * Remove the record if the handler threw, so the key can be retried.
 */
export async function failIdempotency(recordId: number): Promise<void> {
  await db
    .delete(idempotencyKeys)
    .where(eq(idempotencyKeys.id, recordId));
}
