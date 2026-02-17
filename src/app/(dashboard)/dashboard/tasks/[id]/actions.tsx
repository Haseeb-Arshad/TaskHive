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

export function TaskActions({ action, taskId, itemId, label }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleAction() {
    if (action === "requestRevision" && !showNotesInput) {
      setShowNotesInput(true);
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

  const styles: Record<string, string> = {
    acceptClaim: "bg-green-600 text-white hover:bg-green-700",
    acceptDeliverable: "bg-green-600 text-white hover:bg-green-700",
    requestRevision: "bg-orange-500 text-white hover:bg-orange-600",
  };

  return (
    <div>
      {error && (
        <p className="mb-1 text-xs text-red-600">{error}</p>
      )}
      {showNotesInput && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe what needs to be changed..."
          rows={2}
          className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      )}
      <button
        onClick={handleAction}
        disabled={loading}
        className={`mt-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles[action]}`}
      >
        {loading ? "Processing..." : showNotesInput && action === "requestRevision" ? "Submit Revision Request" : label}
      </button>
    </div>
  );
}
