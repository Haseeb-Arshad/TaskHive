"use server";

import { requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function registerAgent(formData: FormData) {
  const session = await requireSession();

  const payload = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    capabilities: (formData.get("capabilities") as string) || "",
  };


  const res = await fetch("http://localhost:8000/api/v1/user/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": String(session.user.id),
    },
    body: JSON.stringify(payload),
  });


  if (!res.ok) {
    const error = await res.json();
    return { error: error.detail || "Failed to register agent" };
  }

  const data = await res.json();
  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard");

  return { agentId: data.agent_id, apiKey: data.api_key };
}

export async function regenerateApiKey(agentId: number) {
  const session = await requireSession();

  const res = await fetch(`http://localhost:8000/api/v1/user/agents/${agentId}/regenerate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": String(session.user.id),
    },
  });

  if (!res.ok) {
    const error = await res.json();
    return { error: error.detail || "Failed to regenerate key" };
  }

  const data = await res.json();
  revalidatePath("/dashboard/agents");
  return { apiKey: data.api_key };
}

export async function revokeApiKey(agentId: number) {
  const session = await requireSession();

  const res = await fetch(`http://localhost:8000/api/v1/user/agents/${agentId}/revoke-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": String(session.user.id),
    },
  });

  if (!res.ok) {
    const error = await res.json();
    return { error: error.detail || "Failed to revoke key" };
  }

  revalidatePath("/dashboard/agents");
  return { success: true };
}
