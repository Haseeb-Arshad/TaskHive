"use client";

import { useEffect, useRef, useState } from "react";
import { useExecutionProgress } from "@/hooks/use-execution-progress";
import type { ProgressStep } from "@/hooks/use-execution-progress";
import { API_BASE_URL } from "@/lib/api-client";

interface AgentActivityTabProps {
  taskId: number;
  taskStatus: string;
}

interface ExecutionData {
  id: number;
  status: string;
  total_tokens_used: number;
  total_cost_usd: number | null;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  workspace_path: string | null;
  error_message: string | null;
}

interface SubtaskData {
  id: number;
  order_index: number;
  title: string;
  description: string;
  status: string;
  result: string | null;
  files_changed: string[] | null;
}

const PHASES = [
  { key: "triage",        label: "Triage",   desc: "Analyzing task requirements" },
  { key: "clarification", label: "Clarify",  desc: "Checking if questions needed" },
  { key: "planning",      label: "Plan",     desc: "Creating execution plan" },
  { key: "execution",     label: "Execute",  desc: "Writing code & files" },
  { key: "review",        label: "Review",   desc: "Quality verification" },
  { key: "delivery",      label: "Deliver",  desc: "Submitting deliverables" },
];

export function AgentActivityTab({ taskId, taskStatus }: AgentActivityTabProps) {
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const { steps, currentPhase, progressPct, connected } =
    useExecutionProgress(executionId);

  // Fetch execution data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/orchestrator/tasks/by-task/${taskId}/active`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.ok && json.data) {
            const eid = json.data.execution_id;
            setExecutionId(eid);

            // Fetch execution details
            try {
              const detailRes = await fetch(
                `${API_BASE_URL}/orchestrator/tasks/${eid}`
              );
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (!cancelled) setExecution(detail.data);
              }
            } catch { /* ignore */ }

            // Fetch subtasks
            try {
              const previewRes = await fetch(
                `${API_BASE_URL}/orchestrator/preview/executions/${eid}`
              );
              if (previewRes.ok) {
                const preview = await previewRes.json();
                if (!cancelled && preview.data?.subtasks) {
                  setSubtasks(preview.data.subtasks);
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch {
        // API not available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    // Poll for updates every 15s
    const interval = setInterval(fetchData, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  // Auto-scroll activity log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  // ── Waiting state ──
  if (taskStatus === "open") {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-stone-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <p className="mb-1.5 text-sm font-semibold text-stone-700">
          Waiting for an agent
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-stone-400">
          Once an agent claims and starts working on this task, you&apos;ll see their real-time
          progress here — from planning to code execution to delivery.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-sm text-stone-400">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-stone-300" />
          Loading agent activity...
        </div>
      </div>
    );
  }

  if (!executionId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-1 text-sm font-semibold text-stone-700">No execution data</p>
        <p className="text-xs text-stone-400">
          Agent activity will appear here once the orchestrator starts processing.
        </p>
      </div>
    );
  }

  // ── Compute state ──
  const isActive = ["claimed", "in_progress"].includes(taskStatus);
  const isComplete = execution?.status === "completed" || taskStatus === "completed" || taskStatus === "delivered";
  const isFailed = execution?.status === "failed";

  // Group steps by phase
  const phaseSteps = new Map<string, ProgressStep[]>();
  for (const step of steps) {
    const existing = phaseSteps.get(step.phase) || [];
    existing.push(step);
    phaseSteps.set(step.phase, existing);
  }

  // Recent activity
  const recentActivity = steps
    .filter((s) => s.detail || s.description)
    .slice(-12);

  // Elapsed time
  const startTime = execution?.started_at ? new Date(execution.started_at) : null;
  const endTime = execution?.completed_at ? new Date(execution.completed_at) : null;
  const elapsed = startTime
    ? (endTime || new Date()).getTime() - startTime.getTime()
    : 0;
  const elapsedStr =
    elapsed > 60000
      ? `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`
      : `${Math.floor(elapsed / 1000)}s`;

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              isComplete
                ? "bg-emerald-500"
                : isFailed
                  ? "bg-red-500"
                  : "bg-[#E5484D] animate-pulse"
            }`}
          />
          <span className="text-sm font-semibold text-stone-800">
            {isComplete
              ? "Agent completed your task"
              : isFailed
                ? "Execution failed"
                : "Agent is working on your task"}
          </span>
          {connected && isActive && (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-stone-400">
          {elapsed > 0 && (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {elapsedStr}
            </span>
          )}
          {execution?.total_tokens_used ? (
            <span>{(execution.total_tokens_used / 1000).toFixed(1)}k tokens</span>
          ) : null}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-6 h-2.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isComplete
              ? "bg-emerald-500"
              : isFailed
                ? "bg-red-500"
                : "bg-gradient-to-r from-[#E5484D] to-[#ff7b7f]"
          }`}
          style={{ width: `${Math.min(isComplete ? 100 : progressPct, 100)}%` }}
        />
      </div>

      {/* ── Phase pipeline ── */}
      <div className="mb-6 grid grid-cols-6 gap-1">
        {PHASES.map((phase, i) => {
          const pSteps = phaseSteps.get(phase.key);
          const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);
          const isDone = isComplete || (pSteps && currentIdx > i);
          const isCurrent = phase.key === currentPhase && !isComplete;
          const isExpanded = expandedPhase === phase.key;
          const latestStep = pSteps?.[pSteps.length - 1];

          return (
            <button
              key={phase.key}
              onClick={() =>
                setExpandedPhase(isExpanded ? null : pSteps ? phase.key : null)
              }
              className={`group flex flex-col items-center rounded-xl px-1 py-3 transition-all duration-300 ${
                isCurrent
                  ? "bg-[#FFF1F2] ring-1 ring-[#E5484D]/20"
                  : isExpanded
                    ? "bg-stone-50 ring-1 ring-stone-200"
                    : pSteps
                      ? "hover:bg-stone-50 cursor-pointer"
                      : "cursor-default opacity-40"
              }`}
            >
              {/* Phase circle */}
              <div
                className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-100 text-emerald-600"
                    : isCurrent
                      ? "bg-[#E5484D] text-white shadow-lg shadow-red-200/50 scale-110"
                      : "bg-stone-100 text-stone-400"
                }`}
              >
                {isDone ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <PhaseIcon phase={phase.key} />
                )}
              </div>

              {/* Phase label */}
              <span
                className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  isCurrent
                    ? "text-[#E5484D]"
                    : isDone
                      ? "text-stone-600"
                      : "text-stone-300"
                }`}
              >
                {phase.label}
              </span>

              {/* Current phase detail */}
              {isCurrent && latestStep && (
                <span className="mt-1 text-[10px] text-stone-500 text-center line-clamp-1">
                  {latestStep.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Expanded phase detail ── */}
      {expandedPhase && phaseSteps.get(expandedPhase) && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-stone-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="mb-2 text-xs font-semibold text-stone-600">
            {PHASES.find((p) => p.key === expandedPhase)?.label} Details
          </p>
          <div className="space-y-1.5">
            {phaseSteps.get(expandedPhase)!.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                <span className="text-stone-600">{step.detail || step.description}</span>
                {step.metadata && Object.keys(step.metadata).length > 0 && (
                  <div className="ml-auto flex gap-1">
                    {Object.entries(step.metadata).slice(0, 3).map(([k, v]) => (
                      <span key={k} className="rounded bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Subtasks ── */}
      {subtasks.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
              Subtasks
            </p>
            <span className="text-xs text-stone-400">
              {subtasks.filter((s) => s.status === "completed").length}/
              {subtasks.length} complete
            </span>
          </div>
          <div className="space-y-2">
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start gap-3 rounded-xl border border-stone-100 bg-white px-4 py-3 transition-colors hover:border-stone-200"
              >
                <div className="mt-0.5">
                  {sub.status === "completed" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  ) : sub.status === "in_progress" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF1F2]">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#E5484D]" />
                    </div>
                  ) : sub.status === "failed" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-red-500"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-stone-200">
                      <span className="text-[9px] font-bold text-stone-300">{sub.order_index + 1}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-stone-700">{sub.title}</span>
                  {sub.files_changed && sub.files_changed.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sub.files_changed.slice(0, 4).map((f, i) => (
                        <span key={i} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-500">
                          {f.split("/").pop()}
                        </span>
                      ))}
                      {sub.files_changed.length > 4 && (
                        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-400">
                          +{sub.files_changed.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity log ── */}
      {recentActivity.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
            Activity Log
          </p>
          <div className="overflow-hidden rounded-xl border border-stone-100 bg-stone-900">
            <div
              ref={logRef}
              className="max-h-52 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
            >
              {recentActivity.map((step, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="shrink-0 text-stone-600 select-none">$</span>
                  <span className="text-emerald-400/80">[{step.phase}]</span>
                  <span className="text-stone-300">{step.detail || step.description}</span>
                </div>
              ))}
              {isActive && (
                <div className="flex items-center gap-1 py-0.5 text-stone-500">
                  <span className="select-none">$</span>
                  <span className="inline-flex gap-0.5">
                    <span className="animate-pulse">_</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {execution?.error_message && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="mb-1 text-sm font-semibold text-red-700">Execution Failed</p>
          <p className="text-xs text-red-600">{execution.error_message}</p>
        </div>
      )}
    </div>
  );
}

/* ── Phase icons ── */
function PhaseIcon({ phase }: { phase: string }) {
  const cls = "h-4 w-4";
  switch (phase) {
    case "triage":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "clarification":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "planning":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "execution":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "review":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "delivery":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    default:
      return <span className="text-xs font-bold">?</span>;
  }
}
