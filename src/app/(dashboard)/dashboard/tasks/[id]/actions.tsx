"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptClaim, acceptDeliverable, requestRevision } from "@/lib/actions/tasks";
import { useTaskStore } from "@/stores/task-store";
import { useToastStore } from "@/components/toast";

interface Props {
  action: "acceptClaim" | "acceptDeliverable" | "requestRevision";
  taskId: number;
  itemId: number;
  label: string;
  showNotes?: boolean;
}

export function TaskActions({ action, taskId, itemId, label, showNotes }: Props) {
  const router                          = useRouter();
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [notesOpen, setNotesOpen]       = useState(false);
  const [notes, setNotes]               = useState("");

  const updateTask = useTaskStore((s) => s.updateTask);
  const addToast = useToastStore((s) => s.addToast);

  async function handleAction() {
    if (showNotes && !notesOpen) { setNotesOpen(true); return; }
    setLoading(true); setError("");

    // Optimistic update: immediately update the Zustand store
    const optimisticStatus =
      action === "acceptClaim" ? "claimed" :
      action === "acceptDeliverable" ? "completed" :
      "in_progress";
    const prevTask = useTaskStore.getState().tasks.get(taskId);
    updateTask(taskId, { status: optimisticStatus });

    let result: any;
    if (action === "acceptClaim")        result = await acceptClaim(taskId, itemId);
    if (action === "acceptDeliverable")  result = await acceptDeliverable(taskId, itemId);
    if (action === "requestRevision")    result = await requestRevision(taskId, itemId, notes);

    setLoading(false);
    if (result?.error) {
      setError(result.error);
      // Revert optimistic update
      if (prevTask) updateTask(taskId, { status: prevTask.status });
      addToast(result.error, "warning");
    } else {
      router.refresh();
    }
  }

  const style: Record<string, string> = {
    acceptClaim:       "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200/40",
    acceptDeliverable: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200/40",
    requestRevision:   "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {notesOpen && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe exactly what needs to change..."
          rows={3}
          className="field"
        />
      )}
      <button
        onClick={handleAction}
        disabled={loading || (notesOpen && !notes.trim())}
        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50 ${style[action]}`}
      >
        {loading && <span className="a-spin h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent opacity-70" />}
        {loading ? "Processing..." : notesOpen && action === "requestRevision" ? "Submit" : label}
      </button>
    </div>
  );
}
