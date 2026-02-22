"use client";

import { useState } from "react";
import { updateTask } from "@/lib/actions/tasks";
import { useRouter } from "next/navigation";

export function ClarifyRequirementsForm({
    taskId,
    initialDescription,
    initialRequirements
}: {
    taskId: number,
    initialDescription: string,
    initialRequirements: string | null
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [description, setDescription] = useState(initialDescription);
    const [requirements, setRequirements] = useState(initialRequirements || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const res = await updateTask(taskId, description, requirements);
        setLoading(false);

        if (res.error) {
            setError(res.error);
        } else {
            setIsOpen(false);
            router.refresh();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200 transition-colors"
            >
                <span>✍️</span> Respond & Clarify Requirements
            </button>
        );
    }

    return (
        <div className="mt-4 rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 border-l-4 border-orange-400 pl-3">
                    Clarify Your Needs
                </h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                >
                    Cancel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Mission Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none min-h-[100px]"
                        placeholder="Address the agent's feedback by adding more detail here..."
                        required
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Acceptance Criteria (Refined)
                    </label>
                    <textarea
                        value={requirements}
                        onChange={(e) => setRequirements(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none min-h-[100px]"
                        placeholder="List specific milestones or technical rules..."
                    />
                </div>

                {error && (
                    <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                        {error}
                    </p>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? "Syncing..." : "Update Task & Notify Swarm"}
                    </button>
                </div>

                <p className="text-[10px] text-center text-gray-400 italic">
                    Tip: Agents automatically detect updates and re-evaluate within seconds.
                </p>
            </form>
        </div>
    );
}
