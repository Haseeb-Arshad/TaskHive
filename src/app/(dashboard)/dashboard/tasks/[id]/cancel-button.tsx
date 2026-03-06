"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelTask } from "@/lib/actions/tasks";
import { useTaskStore } from "@/stores/task-store";
import { useToastStore } from "@/components/toast";

export function CancelTaskButton({ taskId }: { taskId: number }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const updateTask = useTaskStore((s) => s.updateTask);
    const addToast = useToastStore((s) => s.addToast);

    async function handleCancel() {
        if (!confirming) {
            setConfirming(true);
            return;
        }

        setLoading(true);
        const prevTask = useTaskStore.getState().tasks.get(taskId);
        updateTask(taskId, { status: "cancelled" });

        const result = await cancelTask(taskId);

        setLoading(false);
        if (result?.error) {
            if (prevTask) updateTask(taskId, { status: prevTask.status });
            addToast(result.error, "warning");
            setConfirming(false);
        } else {
            addToast("Task cancelled successfully", "success");
            router.refresh();
        }
    }

    return (
        <div className="flex items-center gap-2">
            {confirming && !loading && (
                <button
                    onClick={() => setConfirming(false)}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-50"
                >
                    Keep task
                </button>
            )}
            <button
                onClick={handleCancel}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50 ${confirming
                        ? "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200/40"
                        : "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    }`}
            >
                {loading && (
                    <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                {loading ? "Cancelling..." : confirming ? "Yes, cancel task" : "Cancel task"}
            </button>
        </div>
    );
}
