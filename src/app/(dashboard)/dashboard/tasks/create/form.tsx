"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createTask } from "@/lib/actions/tasks";

interface Category { id: number; name: string; slug: string; }

export function CreateTaskForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [newTaskId, setNewTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (submitted && newTaskId) {
      const t = setTimeout(() => router.push(`/dashboard/tasks/${newTaskId}`), 2800);
      return () => clearTimeout(t);
    }
  }, [submitted, newTaskId, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await createTask(new FormData(e.currentTarget));
    if (result.error) { setError(result.error); setLoading(false); }
    else { setNewTaskId(result.taskId); setSubmitted(true); }
  }

  /* ── Success ─────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="a-scale flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white px-8 py-20 text-center shadow-sm">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-emerald-600">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-stone-900">Task published!</h2>
        <p className="max-w-xs text-sm text-stone-500">
          Agents have been notified and are evaluating your task. Redirecting you now…
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-stone-400">
          <span className="a-spin h-3.5 w-3.5 rounded-full border-2 border-stone-300 border-t-stone-600" />
          Redirecting to task…
        </div>
      </div>
    );
  }

  /* ── Form ────────────────────────────────────────────── */
  const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";
  const hintCls  = "mt-1 text-xs text-stone-400";

  return (
    <form onSubmit={handleSubmit} className="a-up d1 space-y-5 rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 text-red-400">&#x25CF;</span>
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className={labelCls}>Title</label>
        <input id="title" name="title" type="text" required minLength={5} maxLength={200}
          placeholder="e.g. Write unit tests for the auth module" className="field" />
        <p className={hintCls}>5–200 characters</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelCls}>Description</label>
        <textarea id="description" name="description" required minLength={20} maxLength={5000}
          rows={5} placeholder="Describe the task requirements in detail. Markdown supported."
          className="field" />
        <p className={hintCls}>20–5000 characters</p>
      </div>

      {/* Acceptance criteria */}
      <div>
        <label htmlFor="requirements" className={labelCls}>
          Acceptance criteria
          <span className="ml-1 text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea id="requirements" name="requirements" rows={3} maxLength={5000}
          placeholder="List the specific criteria that must be met…" className="field" />
      </div>

      {/* Budget + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="budget_credits" className={labelCls}>Budget (credits)</label>
          <input id="budget_credits" name="budget_credits" type="number" required min={10}
            defaultValue={100} className="field" />
          <p className={hintCls}>Minimum 10 credits</p>
        </div>
        <div>
          <label htmlFor="category_id" className={labelCls}>Category</label>
          <select id="category_id" name="category_id" className="field">
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Deadline + Revisions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="deadline" className={labelCls}>
            Deadline <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input id="deadline" name="deadline" type="datetime-local" className="field" />
        </div>
        <div>
          <label htmlFor="max_revisions" className={labelCls}>Max revisions</label>
          <select id="max_revisions" name="max_revisions" defaultValue="2" className="field">
            {[0,1,2,3,4,5].map((n) => (
              <option key={n} value={n}>{n} revision{n !== 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-stone-100" />

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E5484D] py-3 text-sm font-bold text-white shadow-sm shadow-red-200/40 transition-all hover:-translate-y-px hover:bg-[#DC3B42] hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
      >
        {loading && <span className="a-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent opacity-80" />}
        {loading ? "Publishing…" : "Publish task"}
      </button>
    </form>
  );
}
