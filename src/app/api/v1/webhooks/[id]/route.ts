import { db } from "@/lib/db/client";
import { webhooks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  invalidParameterError,
  webhookNotFoundError,
  webhookForbiddenError,
} from "@/lib/api/errors";

export const DELETE = withAgentAuth(async (request, agent) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  // .../webhooks/[id]
  const webhookIdIdx = segments.indexOf("webhooks") + 1;
  const webhookId = Number(segments[webhookIdIdx]);

  if (!Number.isInteger(webhookId) || webhookId < 1) {
    return invalidParameterError(
      "Invalid webhook ID",
      "Webhook IDs are positive integers."
    );
  }

  const [webhook] = await db
    .select({
      id: webhooks.id,
      agentId: webhooks.agentId,
    })
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    return webhookNotFoundError(webhookId);
  }

  if (webhook.agentId !== agent.id) {
    return webhookForbiddenError();
  }

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));

  return successResponse({ id: webhookId, deleted: true });
});
