import crypto from "crypto";
import { db } from "@/lib/db/client";
import { webhooks, webhookDeliveries, agents } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { WEBHOOK_DELIVERY_TIMEOUT_MS } from "@/lib/constants";
import type { WebhookEvent } from "@/lib/validators/webhooks";

/**
 * Generate a webhook signing secret — 32 random bytes → 64 hex chars.
 * Returns both the raw secret and a prefix for display.
 */
export function generateWebhookSecret(): {
  rawSecret: string;
  prefix: string;
} {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const rawSecret = Buffer.from(bytes).toString("hex");
  const prefix = rawSecret.substring(0, 8);
  return { rawSecret, prefix };
}

/**
 * HMAC-SHA256 sign a payload string with a secret.
 * Returns "sha256=<hex>" format.
 */
export function signPayload(secret: string, body: string): string {
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hmac}`;
}

/**
 * Build a JSON payload string for a webhook event.
 */
export function buildPayload(
  event: WebhookEvent,
  data: Record<string, unknown>
): string {
  return JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Deliver a webhook: POST the payload with signature headers, log the result.
 */
async function deliverWebhook(
  webhook: { id: number; url: string; secret: string },
  event: WebhookEvent,
  payload: string
): Promise<void> {
  const signature = signPayload(webhook.secret, payload);
  const timestamp = new Date().toISOString();
  const start = Date.now();

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      WEBHOOK_DELIVERY_TIMEOUT_MS
    );

    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TaskHive-Signature": signature,
        "X-TaskHive-Event": event,
        "X-TaskHive-Timestamp": timestamp,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = res.status;
    responseBody = (await res.text()).substring(0, 1000);
    success = res.ok;
  } catch {
    // Network error / timeout — logged below
  }

  const durationMs = Date.now() - start;

  await db.insert(webhookDeliveries).values({
    webhookId: webhook.id,
    event,
    payload,
    responseStatus,
    responseBody,
    success,
    attemptedAt: new Date(),
    durationMs,
  });
}

/**
 * Dispatch a webhook event to all active webhooks for a given agent
 * that are subscribed to the event. Fire-and-forget.
 */
export function dispatchWebhookEvent(
  agentId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  const payload = buildPayload(event, data);

  const run = async () => {
    const matchingWebhooks = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        secret: webhooks.secret,
      })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.agentId, agentId),
          eq(webhooks.isActive, true),
          sql`${webhooks.events} && ARRAY[${sql.raw(`'${event}'`)}]::webhook_event[]`
        )
      );

    await Promise.allSettled(
      matchingWebhooks.map((wh) => deliverWebhook(wh, event, payload))
    );
  };

  void run();
}

/**
 * Dispatch task.new_match to all agents whose categoryIds overlap
 * the task's category and have an active webhook subscribed to the event.
 */
export function dispatchNewTaskMatch(
  taskId: number,
  categoryId: number | null,
  taskData: Record<string, unknown>
): void {
  if (!categoryId) return;

  const event: WebhookEvent = "task.new_match";
  const payload = buildPayload(event, taskData);

  const run = async () => {
    const matchingWebhooks = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        secret: webhooks.secret,
      })
      .from(webhooks)
      .innerJoin(agents, eq(webhooks.agentId, agents.id))
      .where(
        and(
          eq(webhooks.isActive, true),
          sql`${webhooks.events} && ARRAY[${sql.raw(`'${event}'`)}]::webhook_event[]`,
          sql`${agents.categoryIds} && ARRAY[${categoryId}]::integer[]`
        )
      );

    await Promise.allSettled(
      matchingWebhooks.map((wh) => deliverWebhook(wh, event, payload))
    );
  };

  void run();
}
