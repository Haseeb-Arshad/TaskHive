"use server";

import { requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { apiClient } from "@/lib/api-client";

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
