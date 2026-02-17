"use server";

import { db } from "@/lib/db/client";
import {
  tasks,
  taskClaims,
  deliverables,
  agents,
  categories,
} from "@/lib/db/schema";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { createTaskSchema } from "@/lib/validators/tasks";
import { processTaskCompletion } from "@/lib/credits/ledger";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
  const session = await requireSession();

  const raw = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    requirements: (formData.get("requirements") as string) || undefined,
    budget_credits: Number(formData.get("budget_credits")),
    category_id: formData.get("category_id")
      ? Number(formData.get("category_id"))
      : undefined,
    deadline: (formData.get("deadline") as string) || undefined,
    max_revisions: formData.get("max_revisions")
      ? Number(formData.get("max_revisions"))
      : undefined,
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  const [task] = await db
    .insert(tasks)
    .values({
      posterId: session.user.id,
      title: data.title,
      description: data.description,
      requirements: data.requirements || null,
      budgetCredits: data.budget_credits,
      categoryId: data.category_id || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      maxRevisions: data.max_revisions ?? 2,
      status: "open",
    })
    .returning({ id: tasks.id });

  revalidatePath("/dashboard");
  return { taskId: task.id };
}

export async function acceptClaim(taskId: number, claimId: number) {
  const session = await requireSession();

  // Verify task ownership
  const [task] = await db
    .select({ id: tasks.id, posterId: tasks.posterId, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task || task.posterId !== session.user.id) {
    return { error: "Task not found or not yours" };
  }

  if (task.status !== "open") {
    return { error: `Task is not open (status: ${task.status})` };
  }

  // Verify claim
  const [claim] = await db
    .select()
    .from(taskClaims)
    .where(
      and(
        eq(taskClaims.id, claimId),
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.status, "pending")
      )
    )
    .limit(1);

  if (!claim) {
    return { error: "Claim not found or not pending" };
  }

  // Accept this claim
  await db
    .update(taskClaims)
    .set({ status: "accepted" })
    .where(eq(taskClaims.id, claimId));

  // Reject all other pending claims
  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(
      and(
        eq(taskClaims.taskId, taskId),
        ne(taskClaims.id, claimId),
        eq(taskClaims.status, "pending")
      )
    );

  // Update task
  await db
    .update(tasks)
    .set({
      status: "claimed",
      claimedByAgentId: claim.agentId,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { success: true };
}

export async function acceptDeliverable(
  taskId: number,
  deliverableId: number
) {
  const session = await requireSession();

  const [task] = await db
    .select({
      id: tasks.id,
      posterId: tasks.posterId,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
      claimedByAgentId: tasks.claimedByAgentId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task || task.posterId !== session.user.id) {
    return { error: "Task not found or not yours" };
  }

  if (task.status !== "delivered") {
    return { error: `Task is not in delivered state (status: ${task.status})` };
  }

  // Validate deliverable
  const [del] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.taskId, taskId)
      )
    )
    .limit(1);

  if (!del) {
    return { error: "Deliverable not found" };
  }

  // Accept deliverable
  await db
    .update(deliverables)
    .set({ status: "accepted" })
    .where(eq(deliverables.id, deliverableId));

  // Complete task
  await db
    .update(tasks)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Process credits
  if (task.claimedByAgentId) {
    const [agent] = await db
      .select({ operatorId: agents.operatorId })
      .from(agents)
      .where(eq(agents.id, task.claimedByAgentId))
      .limit(1);

    if (agent) {
      await processTaskCompletion(
        agent.operatorId,
        task.budgetCredits,
        taskId
      );

      await db
        .update(agents)
        .set({
          tasksCompleted: sql`${agents.tasksCompleted} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, task.claimedByAgentId));
    }
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function requestRevision(
  taskId: number,
  deliverableId: number,
  notes: string
) {
  const session = await requireSession();

  const [task] = await db
    .select({
      id: tasks.id,
      posterId: tasks.posterId,
      status: tasks.status,
      maxRevisions: tasks.maxRevisions,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task || task.posterId !== session.user.id) {
    return { error: "Task not found or not yours" };
  }

  if (task.status !== "delivered") {
    return { error: "Task is not in delivered state" };
  }

  const [del] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.taskId, taskId)
      )
    )
    .limit(1);

  if (!del) {
    return { error: "Deliverable not found" };
  }

  if (del.revisionNumber >= task.maxRevisions + 1) {
    return { error: "Maximum revisions reached" };
  }

  // Mark deliverable as revision_requested
  await db
    .update(deliverables)
    .set({ status: "revision_requested", revisionNotes: notes })
    .where(eq(deliverables.id, deliverableId));

  // Move task back to in_progress
  await db
    .update(tasks)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { success: true };
}

export async function getCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder);
}
