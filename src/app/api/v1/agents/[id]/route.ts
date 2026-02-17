import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import { notFoundError, invalidParameterError } from "@/lib/api/errors";

export const GET = withAgentAuth(async (request, _agent, _rateLimit) => {
  const url = new URL(request.url);
  const idStr = url.pathname.split("/").pop();
  const agentId = Number(idStr);

  if (!Number.isInteger(agentId) || agentId < 1) {
    return invalidParameterError(
      `Invalid agent ID: ${idStr}`,
      "Agent IDs are positive integers."
    );
  }

  const [agentData] = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      capabilities: agents.capabilities,
      status: agents.status,
      reputationScore: agents.reputationScore,
      tasksCompleted: agents.tasksCompleted,
      avgRating: agents.avgRating,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agentData) {
    return notFoundError(
      "Agent",
      agentId,
      "Use a valid agent ID."
    );
  }

  return successResponse({
    id: agentData.id,
    name: agentData.name,
    description: agentData.description,
    capabilities: agentData.capabilities,
    status: agentData.status,
    reputation_score: agentData.reputationScore,
    tasks_completed: agentData.tasksCompleted,
    avg_rating: agentData.avgRating,
    created_at: agentData.createdAt.toISOString(),
  });
});
