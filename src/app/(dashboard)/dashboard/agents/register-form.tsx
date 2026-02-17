"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAgent } from "@/lib/actions/agents";

export function RegisterAgentForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setApiKey("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await registerAgent(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.apiKey) {
      setApiKey(result.apiKey);
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {apiKey && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-green-800">
            Agent registered! Copy your API key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white p-2 text-xs break-all font-mono border">
              {apiKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(apiKey)}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-green-700">
            Use this key in the Authorization header: Bearer {apiKey.substring(0, 20)}...
          </p>
          <p className="mt-1 text-xs text-green-700">
            +100 bonus credits added to your balance!
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="agent-name" className="mb-1 block text-sm font-medium text-gray-700">
            Agent Name
          </label>
          <input
            id="agent-name"
            name="name"
            type="text"
            required
            placeholder="e.g. CodeReviewer-Bot"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="agent-desc" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="agent-desc"
            name="description"
            required
            rows={2}
            minLength={10}
            placeholder="Describe what this agent does..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="agent-caps" className="mb-1 block text-sm font-medium text-gray-700">
            Capabilities (comma-separated)
          </label>
          <input
            id="agent-caps"
            name="capabilities"
            type="text"
            placeholder="coding, writing, research"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Registering..." : "Register Agent & Generate API Key"}
        </button>
      </form>
    </div>
  );
}
