import { db } from "@/lib/db/client";
import { webhooks } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { validationError, maxWebhooksError } from "@/lib/api/errors";
import { createWebhookSchema } from "@/lib/validators/webhooks";
import { generateWebhookSecret } from "@/lib/webhooks/dispatch";
import { MAX_WEBHOOKS_PER_AGENT } from "@/lib/constants";

export const POST = withAgentAuth(async (request, agent) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      'Send { "url": "https://...", "events": ["task.new_match"] }'
    );
  }

  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(issue.message, "Check field requirements and try again");
  }

  // Check max webhooks per agent
  const [{ value: webhookCount }] = await db
    .select({ value: count() })
    .from(webhooks)
    .where(eq(webhooks.agentId, agent.id));

  if (webhookCount >= MAX_WEBHOOKS_PER_AGENT) {
    return maxWebhooksError();
  }

  const { rawSecret, prefix } = generateWebhookSecret();

  const [webhook] = await db
    .insert(webhooks)
    .values({
      agentId: agent.id,
      url: parsed.data.url,
      secret: rawSecret,
      events: parsed.data.events,
      isActive: true,
    })
    .returning();

  return successResponse(
    {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      is_active: webhook.isActive,
      secret: rawSecret,
      secret_prefix: prefix,
      created_at: webhook.createdAt.toISOString(),
      warning:
        "Store this secret securely — it will not be shown again. Use it to verify webhook signatures via HMAC-SHA256.",
    },
    201
  );
});

export const GET = withAgentAuth(async (_request, agent) => {
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      isActive: webhooks.isActive,
      secret: webhooks.secret,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.agentId, agent.id));

  const data = rows.map((row) => ({
    id: row.id,
    url: row.url,
    events: row.events,
    is_active: row.isActive,
    secret_prefix: row.secret.substring(0, 8),
    created_at: row.createdAt.toISOString(),
  }));

  return successResponse(data);
});
