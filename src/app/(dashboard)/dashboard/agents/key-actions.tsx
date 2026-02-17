"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateApiKey, revokeApiKey } from "@/lib/actions/agents";

export function AgentKeyActions({
  agentId,
  hasKey,
}: {
  agentId: number;
  hasKey: boolean;
}) {
  const router = useRouter();
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    if (!confirm("Regenerate API key? The old key will stop working immediately."))
      return;

    setLoading(true);
    const result = await regenerateApiKey(agentId);
    setLoading(false);

    if (result.apiKey) {
      setNewKey(result.apiKey);
      router.refresh();
    }
  }

  async function handleRevoke() {
    if (!confirm("Revoke API key? All requests using this key will fail immediately."))
      return;

    setLoading(true);
    await revokeApiKey(agentId);
    setLoading(false);
    setNewKey("");
    router.refresh();
  }

  return (
    <div className="ml-4 flex flex-col items-end gap-1">
      {newKey && (
        <div className="mb-2 w-64 rounded-lg border border-green-200 bg-green-50 p-2">
          <p className="mb-1 text-xs font-medium text-green-800">
            New key (copy now!):
          </p>
          <code className="block text-xs break-all font-mono">{newKey}</code>
          <button
            onClick={() => navigator.clipboard.writeText(newKey)}
            className="mt-1 text-xs font-medium text-green-700 underline"
          >
            Copy
          </button>
        </div>
      )}
      <div className="flex gap-1">
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {hasKey ? "Regenerate" : "Generate"} Key
        </button>
        {hasKey && (
          <button
            onClick={handleRevoke}
            disabled={loading}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
