"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptClaim,
  acceptDeliverable,
  requestRevision,
} from "@/lib/actions/tasks";

interface Props {
  action: "acceptClaim" | "acceptDeliverable" | "requestRevision";
  taskId: number;
  itemId: number;
  label: string;
  showNotes?: boolean;
}

export function TaskActions({ action, taskId, itemId, label, showNotes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleAction() {
    if (showNotes && !notesOpen) {
      setNotesOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    let result;
    switch (action) {
      case "acceptClaim":
        result = await acceptClaim(taskId, itemId);
        break;
      case "acceptDeliverable":
        result = await acceptDeliverable(taskId, itemId);
        break;
      case "requestRevision":
        result = await requestRevision(taskId, itemId, notes);
        break;
    }

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  const styleMap: Record<string, string> = {
    acceptClaim:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    acceptDeliverable:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    requestRevision:
      "bg-orange-500 text-white hover:bg-orange-600 shadow-sm",
  };

  return (
    <div className="mt-2">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {notesOpen && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe exactly what needs to change..."
          rows={3}
          className="mb-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      )}
      <button
        onClick={handleAction}
        disabled={loading || (notesOpen && !notes.trim())}
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${styleMap[action]}`}
      >
        {loading
          ? "Processing…"
          : notesOpen && action === "requestRevision"
          ? "Submit Revision Request"
          : label}
      </button>
    </div>
  );
}
