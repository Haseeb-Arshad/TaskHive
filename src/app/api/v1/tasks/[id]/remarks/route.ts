import { db } from "@/lib/db/client";
import { tasks, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAgentAuth } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/envelope";
import {
  taskNotFoundError,
  validationError,
  invalidParameterError,
} from "@/lib/api/errors";
import { z } from "zod";

const evaluationQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(["multiple_choice", "yes_no", "text_input", "scale"]),
  options: z.array(z.string()).min(2).max(6).optional(),
  placeholder: z.string().optional(),
  scale_min: z.number().optional(),
  scale_max: z.number().optional(),
  scale_labels: z.tuple([z.string(), z.string()]).optional(),
});

const evaluationSchema = z.object({
  score: z.coerce.number().min(1).max(10).transform((v) => Math.round(v)),
  strengths: z.array(z.string()).max(5).default([]),
  concerns: z.array(z.string()).max(5).default([]),
  questions: z.array(evaluationQuestionSchema).max(8).default([]),
});

export const POST = withAgentAuth(async (request, agent, _rateLimit) => {
  // Extract task ID from URL
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const taskIdIdx = segments.indexOf("tasks") + 1;
  const taskId = Number(segments[taskIdIdx]);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return invalidParameterError(
      "Invalid task ID",
      "Task IDs are positive integers."
    );
  }

  // Parse body
  let body: { remark?: string; evaluation?: unknown };
  try {
    body = await request.json();
  } catch {
    return validationError(
      "Invalid JSON body",
      'Send a JSON body with { "remark": "<feedback text>" }'
    );
  }

  const remark = body?.remark?.trim();
  if (!remark) {
    return validationError(
      "Remark text is required",
      'Include a non-empty "remark" field in the request body.'
    );
  }

  // Validate optional evaluation (lenient: drop invalid evaluation, still save remark)
  let evaluation: z.infer<typeof evaluationSchema> | undefined;
  if (body.evaluation && typeof body.evaluation === "object") {
    const parsed = evaluationSchema.safeParse(body.evaluation);
    if (parsed.success) {
      evaluation = parsed.data;
    }
    // If validation fails, we still save the remark — just without evaluation
  }

  // Fetch task
  const [task] = await db
    .select({
      id: tasks.id,
      agentRemarks: tasks.agentRemarks,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return taskNotFoundError(taskId);
  }

  // Get agent name
  const [agentRecord] = await db
    .select({ name: agents.name })
    .from(agents)
    .where(eq(agents.id, agent.id))
    .limit(1);

  const agentName = agentRecord?.name || `Agent #${agent.id}`;

  // Build the remark entry
  const remarkEntry: Record<string, unknown> = {
    agent_id: agent.id,
    agent_name: agentName,
    remark,
    timestamp: new Date().toISOString(),
  };
  if (evaluation) {
    remarkEntry.evaluation = evaluation;
  }

  // Append to existing remarks array (or create new)
  const existing = task.agentRemarks || [];
  const updated = [...existing, remarkEntry];

  await db
    .update(tasks)
    .set({ agentRemarks: updated as typeof existing })
    .where(eq(tasks.id, taskId));

  return successResponse(remarkEntry, 201);
});
