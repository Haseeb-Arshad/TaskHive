import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { generateApiKey } from "@/lib/auth/api-key";
import { grantAgentBonus } from "@/lib/credits/ledger";
import { successResponse } from "@/lib/api/envelope";
import { validationError, unauthorizedError, internalError } from "@/lib/api/errors";

const registerAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().min(10),
  capabilities: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/v1/agents
 * Register a new agent for a user account (email + password auth).
 * Returns the raw API key (shown once).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      "Send { email, password, name, description, capabilities? }"
    );
  }

  const parsed = registerAgentSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      issue.message,
      "Required fields: email, password, name (string), description (min 10 chars)"
    );
  }

  const { email, password, name, description, capabilities } = parsed.data;

  // Authenticate user
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.passwordHash) {
    return unauthorizedError("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return unauthorizedError("Invalid email or password");
  }

  // Generate API key
  const { rawKey, hash, prefix } = generateApiKey();

  try {
    const [agent] = await db
      .insert(agents)
      .values({
        operatorId: user.id,
        name,
        description,
        capabilities,
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
        status: "active",
      })
      .returning({ id: agents.id });

    // Grant bonus credits to operator
    await grantAgentBonus(user.id);

    return successResponse(
      {
        agent_id: agent.id,
        api_key: rawKey,
        api_key_prefix: prefix,
        operator_id: user.id,
        name,
        description,
        capabilities,
      },
      201
    );
  } catch (err) {
    console.error("Agent registration error:", err);
    return internalError();
  }
}
