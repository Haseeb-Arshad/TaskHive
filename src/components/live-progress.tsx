"use client";

import { useRef, useEffect } from "react";
import type { ProgressStep } from "@/hooks/use-execution-progress";

const PHASE_ORDER = ["triage", "clarification", "planning", "execution", "review", "delivery"];

const PHASE_ICONS: Record<string, string> = {
  triage: "Triage",
  clarification: "Clarify",
  planning: "Planning",
  execution: "Execution",
  review: "Review",
  delivery: "Delivery",
  failed: "Failed",
};

interface LiveProgressProps {
  steps: ProgressStep[];
  currentPhase: string | null;
  progressPct: number;
  connected: boolean;
}

export function LiveProgress({
  steps,
  currentPhase,
  progressPct,
  connected,
}: LiveProgressProps) {
  const activityRef = useRef<HTMLDivElement>(null);

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight;
    }
  }, [steps]);

  const isComplete = currentPhase === "delivery";
  const isFailed = currentPhase === "failed";

  // Group steps by phase
  const phaseSteps = new Map<string, ProgressStep[]>();
  for (const step of steps) {
    const existing = phaseSteps.get(step.phase) || [];
    existing.push(step);
    phaseSteps.set(step.phase, existing);
  }

  // Get recent activity entries (last 6 steps with detail)
  const recentActivity = steps
    .filter((s) => s.detail || s.description)
    .slice(-8);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/60 px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isComplete
                ? "bg-emerald-500"
                : isFailed
                  ? "bg-red-500"
                  : "bg-[#E5484D] a-blink"
            }`}
          />
          <span className="text-sm font-semibold text-stone-800">
            {isComplete
              ? "Agent completed your task"
              : isFailed
                ? "Execution failed"
                : "Agent is working on your task"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isComplete && !isFailed && (
            <span className="text-xs text-stone-400">
              {connected ? "Streaming" : "Reconnecting..."}
            </span>
          )}
          <ProgressBar pct={progressPct} />
        </div>
      </div>

      <div className="p-6">
        {/* Phase Timeline */}
        <div className="mb-6 space-y-1">
          {PHASE_ORDER.map((phase) => {
            const pSteps = phaseSteps.get(phase);
            const isDone = pSteps && currentPhase !== phase && PHASE_ORDER.indexOf(currentPhase || "") > PHASE_ORDER.indexOf(phase);
            const isCurrent = phase === currentPhase;
            const latestStep = pSteps?.[pSteps.length - 1];

            return (
              <div
                key={phase}
                className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-all ${
                  isCurrent ? "bg-[#FFF1F2]" : ""
                } ${!pSteps && !isCurrent ? "opacity-40" : ""}`}
              >
                {/* Icon */}
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : isCurrent ? (
                    <span className="h-3 w-3 rounded-full bg-[#E5484D] a-progress-pulse" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-stone-300" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isCurrent
                          ? "text-[#E5484D]"
                          : isDone
                            ? "text-stone-700"
                            : "text-stone-400"
                      }`}
                    >
                      {PHASE_ICONS[phase] || phase}
                    </span>
                    {latestStep?.description && (
                      <span className="truncate text-xs text-stone-500">
                        {latestStep.description}
                      </span>
                    )}
                  </div>

                  {/* Show sub-details for current phase */}
                  {isCurrent && pSteps && pSteps.length > 0 && (
                    <div className="mt-1 space-y-0.5 border-l-2 border-[#E5484D]/20 pl-3">
                      {pSteps.slice(-3).map((s, i) => (
                        <p
                          key={i}
                          className="a-slide-down text-xs text-stone-500"
                        >
                          {s.detail || s.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phase progress */}
                {isCurrent && latestStep && (
                  <span className="shrink-0 text-xs font-medium text-[#E5484D]">
                    {latestStep.progress_pct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Activity Feed */}
        {recentActivity.length > 0 && (
          <div className="rounded-lg border border-stone-100 bg-stone-50/70">
            <div className="border-b border-stone-100 px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
                Current Activity
              </span>
            </div>
            <div
              ref={activityRef}
              className="max-h-40 overflow-y-auto px-4 py-2 font-mono text-xs text-stone-600"
            >
              {recentActivity.map((step, i) => (
                <div
                  key={i}
                  className="a-slide-down flex items-start gap-2 py-0.5"
                >
                  <span className="shrink-0 select-none text-stone-400">
                    &gt;
                  </span>
                  <span>{step.detail || step.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-[#E5484D] transition-all duration-700 ease-out"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="min-w-[2rem] text-right text-xs font-semibold text-stone-600">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
