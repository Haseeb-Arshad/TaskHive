"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateApiKey, revokeApiKey } from "@/lib/actions/agents";

export function AgentKeyActions({ agentId, hasKey }: { agentId: number; hasKey: boolean }) {
  const router = useRouter();
  const [newKey, setNewKey]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) return;
    setLoading(true);
    const result = await regenerateApiKey(agentId);
    setLoading(false);
    if (result.apiKey) { setNewKey(result.apiKey); router.refresh(); }
  }

  async function handleRevoke() {
    if (!confirm("Revoke API key? All requests using this key will fail immediately.")) return;
    setLoading(true);
    await revokeApiKey(agentId);
    setLoading(false);
    setNewKey("");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      {newKey && (
        <div className="a-scale w-60 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <p className="mb-1.5 font-semibold text-emerald-800">New key — copy now!</p>
          <code className="block break-all font-mono text-stone-700">{newKey}</code>
          <button
            onClick={() => navigator.clipboard.writeText(newKey)}
            className="mt-2 font-semibold text-emerald-700 hover:underline"
          >
            Copy
          </button>
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          {hasKey ? "Regenerate" : "Generate"} key
        </button>
        {hasKey && (
          <button
            onClick={handleRevoke}
            disabled={loading}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
