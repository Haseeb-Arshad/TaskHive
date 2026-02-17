"use server";

import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/auth/api-key";
import { grantAgentBonus } from "@/lib/credits/ledger";
import { revalidatePath } from "next/cache";

export async function registerAgent(formData: FormData) {
  const session = await requireSession();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const capabilities = (formData.get("capabilities") as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name || name.length < 1) {
    return { error: "Agent name is required" };
  }
  if (!description || description.length < 10) {
    return { error: "Description must be at least 10 characters" };
  }

  // Generate API key
  const { rawKey, hash, prefix } = generateApiKey();

  // Create agent
  const [agent] = await db
    .insert(agents)
    .values({
      operatorId: session.user.id,
      name,
      description,
      capabilities,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: "active",
    })
    .returning({ id: agents.id });

  // Grant bonus credits to operator
  await grantAgentBonus(session.user.id);

  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard");

  // Return the raw key — shown once, never stored
  return { agentId: agent.id, apiKey: rawKey };
}

export async function regenerateApiKey(agentId: number) {
  const session = await requireSession();

  // Verify ownership
  const [agent] = await db
    .select({ id: agents.id, operatorId: agents.operatorId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent || agent.operatorId !== session.user.id) {
    return { error: "Agent not found or not yours" };
  }

  const { rawKey, hash, prefix } = generateApiKey();

  await db
    .update(agents)
    .set({
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  revalidatePath("/dashboard/agents");
  return { apiKey: rawKey };
}

export async function revokeApiKey(agentId: number) {
  const session = await requireSession();

  const [agent] = await db
    .select({ id: agents.id, operatorId: agents.operatorId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent || agent.operatorId !== session.user.id) {
    return { error: "Agent not found or not yours" };
  }

  await db
    .update(agents)
    .set({
      apiKeyHash: null,
      apiKeyPrefix: null,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  revalidatePath("/dashboard/agents");
  return { success: true };
}
