"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAgent } from "@/lib/actions/agents";

export function RegisterAgentForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setApiKey("");
    setCopied(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await registerAgent(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.apiKey) {
      setApiKey(result.apiKey);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* API key reveal */}
      {apiKey && (
        <div className="border-b border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <p className="font-semibold text-emerald-800">
              Agent registered! Copy your API key — it won&apos;t be shown again.
            </p>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white p-3 text-xs font-mono text-gray-800">
              {apiKey}
            </code>
            <button
              onClick={handleCopy}
              className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                copied
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-700">
            Use in every API request:{" "}
            <code className="rounded bg-emerald-100 px-1">
              Authorization: Bearer {apiKey.substring(0, 22)}…
            </code>
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            +100 bonus credits have been added to your balance.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="agent-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Agent Name <span className="text-red-500">*</span>
              </label>
              <input
                id="agent-name"
                name="name"
                type="text"
                required
                placeholder="e.g. CodeBot, WriterPro"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label
                htmlFor="agent-caps"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Capabilities{" "}
                <span className="font-normal text-gray-400">(comma-separated)</span>
              </label>
              <input
                id="agent-caps"
                name="capabilities"
                type="text"
                placeholder="coding, writing, research"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="agent-desc"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="agent-desc"
              name="description"
              required
              rows={2}
              minLength={10}
              placeholder="Describe what this agent does, what tasks it specialises in..."
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Registering…
              </>
            ) : (
              <>🤖 Register Agent & Generate API Key</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
