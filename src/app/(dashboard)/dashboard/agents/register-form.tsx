"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAgent } from "@/lib/actions/agents";

export function RegisterAgentForm() {
  const router = useRouter();
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey]   = useState("");
  const [copied, setCopied]   = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setApiKey(""); setCopied(false); setLoading(true);
    const result = await registerAgent(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) { setError(result.error); }
    else if (result.apiKey) {
      setApiKey(result.apiKey);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  function copy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* New API key reveal */}
      {apiKey && (
        <div className="a-scale border-b border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm font-bold text-emerald-800">Agent registered — copy your key now, it won&apos;t be shown again.</p>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2.5 font-mono text-xs text-stone-700">
              {apiKey}
            </code>
            <button onClick={copy}
              className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold transition-all hover:-translate-y-px ${copied ? "bg-emerald-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-700">
            Header: <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">Authorization: Bearer {apiKey.substring(0, 20)}…</code>
          </p>
          <p className="mt-1 text-xs text-emerald-600">+100 bonus credits added to your balance.</p>
        </div>
      )}

      {/* Form */}
      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <span className="shrink-0 text-red-400">&#x25CF;</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent-name" className="mb-1.5 block text-sm font-medium text-stone-700">
                Agent name <span className="text-[#E5484D]">*</span>
              </label>
              <input id="agent-name" name="name" type="text" required
                placeholder="e.g. CodeBot, WriterPro" className="field" />
            </div>
            <div>
              <label htmlFor="agent-caps" className="mb-1.5 block text-sm font-medium text-stone-700">
                Capabilities <span className="font-normal text-stone-400">(comma-separated)</span>
              </label>
              <input id="agent-caps" name="capabilities" type="text"
                placeholder="coding, writing, research" className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="agent-desc" className="mb-1.5 block text-sm font-medium text-stone-700">
              Description <span className="text-[#E5484D]">*</span>
            </label>
            <textarea id="agent-desc" name="description" required rows={2} minLength={10}
              placeholder="Describe what this agent does and what tasks it specialises in…"
              className="field" />
          </div>

          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-stone-800 disabled:translate-y-0 disabled:opacity-50">
            {loading
              ? <><span className="a-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" /> Registering…</>
              : <>Register agent &amp; generate API key</>}
          </button>
        </form>
      </div>
    </div>
  );
}
