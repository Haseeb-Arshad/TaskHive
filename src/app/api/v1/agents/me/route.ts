import { db } from "@/lib/db/client";
import { agents, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { internalError, validationError } from "@/lib/api/errors";
import { updateAgentSchema } from "@/lib/validators/tasks";

export const GET = withAgentAuth(async (_request, agent, _rateLimit) => {
  const [agentData] = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      capabilities: agents.capabilities,
      categoryIds: agents.categoryIds,
      hourlyRateCredits: agents.hourlyRateCredits,
      apiKeyPrefix: agents.apiKeyPrefix,
      webhookUrl: agents.webhookUrl,
      status: agents.status,
      reputationScore: agents.reputationScore,
      tasksCompleted: agents.tasksCompleted,
      avgRating: agents.avgRating,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      operatorId: agents.operatorId,
      operatorName: users.name,
      operatorEmail: users.email,
      operatorCredits: users.creditBalance,
    })
    .from(agents)
    .innerJoin(users, eq(agents.operatorId, users.id))
    .where(eq(agents.id, agent.id))
    .limit(1);

  if (!agentData) {
    return internalError();
  }

  return successResponse({
    id: agentData.id,
    name: agentData.name,
    description: agentData.description,
    capabilities: agentData.capabilities,
    category_ids: agentData.categoryIds,
    hourly_rate_credits: agentData.hourlyRateCredits,
    api_key_prefix: agentData.apiKeyPrefix,
    webhook_url: agentData.webhookUrl,
    status: agentData.status,
    reputation_score: agentData.reputationScore,
    tasks_completed: agentData.tasksCompleted,
    avg_rating: agentData.avgRating,
    created_at: agentData.createdAt.toISOString(),
    updated_at: agentData.updatedAt.toISOString(),
    operator: {
      id: agentData.operatorId,
      name: agentData.operatorName,
      credit_balance: agentData.operatorCredits,
    },
  });
});

export const PATCH = withAgentAuth(async (request, agent, _rateLimit) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      "Send a valid JSON object with fields to update"
    );
  }

  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      issue.message,
      "Valid fields: name (1-100 chars), description (max 2000), capabilities (array of strings, max 20), webhook_url (valid URL), hourly_rate_credits (non-negative integer)"
    );
  }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.capabilities !== undefined) updates.capabilities = data.capabilities;
  if (data.hourly_rate_credits !== undefined)
    updates.hourlyRateCredits = data.hourly_rate_credits;
  if (data.webhook_url !== undefined) updates.webhookUrl = data.webhook_url;

  if (Object.keys(updates).length === 0) {
    return successResponse({ message: "No fields to update" });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, agent.id))
    .returning();

  return successResponse({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    capabilities: updated.capabilities,
    hourly_rate_credits: updated.hourlyRateCredits,
    webhook_url: updated.webhookUrl,
    status: updated.status,
    updated_at: updated.updatedAt.toISOString(),
  });
});
