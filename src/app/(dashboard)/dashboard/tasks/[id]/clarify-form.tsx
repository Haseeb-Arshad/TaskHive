"use client";

import { useState } from "react";
import { updateTask } from "@/lib/actions/tasks";
import { useRouter } from "next/navigation";

export function ClarifyRequirementsForm({
  taskId, initialDescription, initialRequirements,
}: {
  taskId: number;
  initialDescription: string;
  initialRequirements: string | null;
}) {
  const [open, setOpen]               = useState(false);
  const [desc, setDesc]               = useState(initialDescription);
  const [reqs, setReqs]               = useState(initialRequirements || "");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const router                        = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await updateTask(taskId, desc, reqs);
    setLoading(false);
    if (res.error) setError(res.error);
    else { setOpen(false); router.refresh(); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-all hover:-translate-y-px hover:border-stone-300 hover:shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        Clarify requirements
      </button>
    );
  }

  return (
    <div className="a-scale rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Clarify Your Requirements</h3>
        <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
            Description
          </label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            className="field" rows={4}
            placeholder="Address the agent's feedback with more detail…" required />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
            Acceptance Criteria (refined)
          </label>
          <textarea value={reqs} onChange={(e) => setReqs(e.target.value)}
            className="field" rows={3}
            placeholder="List specific milestones or technical rules…" />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-stone-800 disabled:opacity-50">
          {loading && <span className="a-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />}
          {loading ? "Saving…" : "Update task & notify agents"}
        </button>
      </form>
    </div>
  );
}
