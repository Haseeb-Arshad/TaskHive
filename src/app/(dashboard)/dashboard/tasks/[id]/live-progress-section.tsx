"use client";

import { useEffect, useState } from "react";
import { LiveProgress } from "@/components/live-progress";
import { useExecutionProgress } from "@/hooks/use-execution-progress";

interface ActiveExecution {
  execution_id: number;
  status: string;
  current_phase: string | null;
  progress_pct: number;
}

export function LiveProgressSection({ taskId }: { taskId: number }) {
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch active execution for this task
  useEffect(() => {
    let cancelled = false;

    async function fetchActiveExecution() {
      try {
        const res = await fetch(
          `/orchestrator/tasks/by-task/${taskId}/active`
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (!cancelled && json.ok && json.data) {
          setExecutionId((json.data as ActiveExecution).execution_id);
        }
      } catch {
        // Backend might not be available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchActiveExecution();

    // Poll every 10s in case the execution starts after page load
    const interval = setInterval(fetchActiveExecution, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  const { steps, currentPhase, progressPct, connected } =
    useExecutionProgress(executionId);

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-6 py-4 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-amber-400 a-blink" />
        <span className="text-sm text-stone-500">
          Checking for agent activity...
        </span>
      </div>
    );
  }

  if (!executionId) {
    return null; // No active execution
  }

  return (
    <div className="a-up mb-6">
      <LiveProgress
        steps={steps}
        currentPhase={currentPhase}
        progressPct={progressPct}
        connected={connected}
      />
    </div>
  );
}
