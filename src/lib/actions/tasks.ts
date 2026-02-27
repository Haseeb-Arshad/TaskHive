"use server";

import { requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { apiClient } from "@/lib/api-client";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function createTask(formData: FormData) {
  const session = await requireSession();

  const payload = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    requirements: (formData.get("requirements") as string) || null,
    budget_credits: Number(formData.get("budget_credits")),
    category_id: formData.get("category_id")
      ? Number(formData.get("category_id"))
      : null,
    deadline: (formData.get("deadline") as string) || null,
    max_revisions: formData.get("max_revisions")
      ? Number(formData.get("max_revisions"))
      : 2,
  };

  const res = await apiClient("/api/v1/user/tasks", {
    method: "POST",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    return { error: error.detail || "Failed to create task" };
  }

  const data = await res.json();
  revalidatePath("/dashboard");
  return { taskId: data.id };
}

export async function acceptClaim(taskId: number, claimId: number) {
  const session = await requireSession();

  const res = await apiClient(`/api/v1/user/tasks/${taskId}/accept-claim`, {
    method: "POST",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify({ claim_id: claimId }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to accept claim";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch {
      // Not JSON
    }
    return { error: errorDetail };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function acceptDeliverable(
  taskId: number,
  deliverableId: number
) {
  const session = await requireSession();

  const res = await apiClient(`/api/v1/user/tasks/${taskId}/accept-deliverable`, {
    method: "POST",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify({ deliverable_id: deliverableId }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to accept deliverable";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch {
      // Not JSON
    }
    return { error: errorDetail };
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

  const res = await apiClient(`/api/v1/user/tasks/${taskId}/request-revision`, {
    method: "POST",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify({ deliverable_id: deliverableId, notes }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to request revision";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch {
      // Not JSON
    }
    return { error: errorDetail };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { success: true };
}

export async function getCategories() {
  const res = await apiClient("/api/v1/meta/categories");
  if (!res.ok) return [];
  return res.json();
}

export async function sendTaskMessage(taskId: number, content: string, messageType = "text") {
  const session = await requireSession();

  const res = await apiClient(`/api/v1/user/tasks/${taskId}/messages`, {
    method: "POST",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify({ content, message_type: messageType }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to send message";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch {}
    return { error: errorDetail };
  }

  return await res.json();
}

export async function respondToQuestion(
  taskId: number,
  messageId: number,
  response: string,
  optionIndex?: number,
) {
  const session = await requireSession();

  const res = await apiClient(
    `/api/v1/user/tasks/${taskId}/messages/${messageId}/respond`,
    {
      method: "PATCH",
      headers: {
        "X-User-ID": String(session.user.id),
      },
      body: JSON.stringify({ response, option_index: optionIndex ?? null }),
    },
  );

  if (!res.ok) {
    let errorDetail = "Failed to respond";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch {}
    return { error: errorDetail };
  }

  return await res.json();
}

export async function submitEvaluationAnswers(
  taskId: number,
  agentId: number,
  answers: { question_id: string; answer: string }[]
) {
  const session = await requireSession();

  // Fetch task directly from DB
  const [task] = await db
    .select({ id: tasks.id, posterId: tasks.posterId, agentRemarks: tasks.agentRemarks })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return { error: "Task not found" };
  if (task.posterId !== session.user.id) return { error: "Not authorized" };

  const agentRemarks = task.agentRemarks || [];
  let updated = false;

  const updatedRemarks = agentRemarks.map((r) => {
    if (r.agent_id !== agentId || !r.evaluation) return r;

    const updatedQuestions = r.evaluation.questions.map((q) => {
      const match = answers.find((a) => a.question_id === q.id);
      if (match) {
        updated = true;
        return { ...q, answer: match.answer, answered_at: new Date().toISOString() };
      }
      return q;
    });

    return { ...r, evaluation: { ...r.evaluation, questions: updatedQuestions } };
  });

  if (!updated) return { error: "No matching questions found" };

  await db
    .update(tasks)
    .set({ agentRemarks: updatedRemarks, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { success: true };
}

export async function updateTask(taskId: number, description: string, requirements: string) {
  const session = await requireSession();

  const res = await apiClient(`/api/v1/user/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify({ description, requirements }),
  });

  if (!res.ok) {
    let errorDetail = "Failed to update task";
    try {
      const error = await res.json();
      errorDetail = error.detail || errorDetail;
    } catch { }
    return { error: errorDetail };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { success: true };
}
