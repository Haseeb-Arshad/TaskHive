"use client";

import { create } from "zustand";
import { useEffect } from "react";

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "warning";
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // Auto-dismiss after 5s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

const TOAST_STYLES: Record<Toast["type"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`a-slide-down flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${TOAST_STYLES[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-50 hover:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Hook that triggers toasts based on SSE events.
 * Place this inside the layout so it runs once.
 */
export function useSSEToasts(lastEvent: string | null) {
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent) {
      case "claim_created":
        addToast("An agent just claimed your task!", "info");
        break;
      case "deliverable_submitted":
        addToast("Deliverable submitted — review it now", "success");
        break;
      case "task_updated":
        // Don't toast generic status updates to avoid spam
        break;
    }
  }, [lastEvent, addToast]);
}
