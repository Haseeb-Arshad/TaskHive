"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useExecutionProgress } from "@/hooks/use-execution-progress";
import type { ProgressStep } from "@/hooks/use-execution-progress";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

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

function deriveSubtasksFromSteps(steps: ProgressStep[]): SubtaskData[] {
  if (steps.length === 0) return [];

  // Preferred fallback: derive roadmap from planning metadata when available.
  // This preserves real subtask/checklist titles before DB subtasks are returned.
  const planningWithMetadata = [...steps]
    .reverse()
    .find(
      (step) =>
        step.phase === "planning" &&
        Array.isArray((step.metadata as Record<string, unknown> | undefined)?.subtasks),
    );

  if (planningWithMetadata) {
    const raw = (planningWithMetadata.metadata as Record<string, unknown>).subtasks;
    const titles = Array.isArray(raw)
      ? raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    if (titles.length > 0) {
      const latest = steps[steps.length - 1];
      const donePhases = new Set(["delivery", "complete", "completed", "delivered"]);
      const failed = latest.phase === "failed";
      const finished = donePhases.has(latest.phase);

      return titles.map((title, idx) => {
        let status = "pending";
        if (finished) {
          status = "completed";
        } else if (failed && idx === 0) {
          status = "failed";
        } else if (idx === 0) {
          status = "in_progress";
        }

        return {
          id: idx + 1,
          order_index: idx + 1,
          title,
          description: "",
          status,
          result: null,
          files_changed: null,
        };
      });
    }
  }

  const byPhase = new Map<string, ProgressStep[]>();
  for (const step of steps) {
    const key = String(step.phase || "").trim();
    if (!key) continue;
    const list = byPhase.get(key) || [];
    list.push(step);
    byPhase.set(key, list);
  }

  const phases = Array.from(byPhase.keys());
  if (phases.length === 0) return [];

  const latestPhase = phases[phases.length - 1];

  return phases.map((phase, idx) => {
    const items = byPhase.get(phase) || [];
    const last = items[items.length - 1];
    let status = "completed";

    if (phase === "failed") {
      status = "failed";
    } else if (phase === latestPhase) {
      const donePhases = new Set(["delivery", "complete", "completed", "delivered"]);
      status = donePhases.has(phase) ? "completed" : "in_progress";
    }

    return {
      id: idx + 1,
      order_index: idx + 1,
      title: phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: last?.description || "",
      status,
      result: last?.detail || null,
      files_changed: null,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   PHASE CONFIG
   ═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   PHASE HEADINGS (for splash)
   ═══════════════════════════════════════════════════════════ */

const SPLASH_HEADINGS: Record<string, string> = {
  triage: "Evaluating your task\u2026",
  clarification: "Checking for clarity\u2026",
  planning: "Planning the approach\u2026",
  execution: "Building your solution\u2026",
  complex_execution: "Deep-diving into the task\u2026",
  review: "Reviewing the work\u2026",
  deployment: "Deploying your project\u2026",
  delivery: "Preparing delivery\u2026",
};

const DOT_COLORS = ["#E5484D", "#F0707A", "#E5484D", "#DC3B42", "#E5484D"];

/* ═══════════════════════════════════════════════════════════
   AGENT PROCESSING SPLASH
   ═══════════════════════════════════════════════════════════ */

function AgentProcessingSplash({
  currentPhase,
  latestDetail,
  progressPct,
  fading,
}: {
  currentPhase: string | null;
  latestDetail: string | null;
  progressPct: number;
  fading: boolean;
}) {
  const heading = (currentPhase && SPLASH_HEADINGS[currentPhase]) || "Spinning up the agent\u2026";

  // SVG ring params
  const R = 24;
  const C = 2 * Math.PI * R; // circumference ~150.8
  const dashOffset = C - (C * Math.min(progressPct, 100)) / 100;

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-20 text-center transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"
        }`}
    >
      {/* ── Progress Ring ── */}
      <div className="relative mb-8">
        <svg width="60" height="60" className="a-ring-rotate">
          {/* Background track */}
          <circle
            cx="30"
            cy="30"
            r={R}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth="3"
          />
          {/* Progress arc */}
          <circle
            cx="30"
            cy="30"
            r={R}
            fill="none"
            stroke={currentPhase === "execution" ? "#DC3B42" : "#E5484D"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={progressPct > 0 ? dashOffset : undefined}
            className={progressPct === 0 ? "a-ring-dash" : ""}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease",
            }}
          />
        </svg>
        {progressPct > 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-stone-500">
            {Math.round(progressPct)}%
          </span>
        )}
      </div>

      {/* ── Animated Dots ── */}
      <div className="mb-6 flex items-center gap-2">
        {DOT_COLORS.map((color, i) => (
          <span
            key={i}
            className="a-dot-breathe block rounded-full"
            style={{
              width: 10,
              height: 10,
              backgroundColor: color,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* ── Heading ── */}
      <p
        key={currentPhase || "init"}
        className="a-text-crossfade mb-2 text-2xl font-medium text-stone-700"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {heading}
      </p>

      {/* ── Subtitle (live detail from SSE) ── */}
      <p
        key={latestDetail || "waiting"}
        className="a-text-crossfade max-w-md text-sm leading-relaxed text-stone-400"
      >
        {latestDetail || "This usually takes 30\u201360 seconds. Sit tight."}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function AgentActivityTab({ taskId, taskStatus }: AgentActivityTabProps) {
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  // Track whether we've received real subtasks from the API (vs derived from SSE phases).
  // Once the backend returns actual planning subtasks, we never fall back to derivation.
  const hasApiSubtasks = useRef(false);

  const { steps, currentPhase, progressPct, connected } =
    useExecutionProgress(executionId);

  // Derive subtasks from SSE phase steps ONLY as a fallback when the API
  // hasn't returned real planning subtasks yet.
  useEffect(() => {
    if (hasApiSubtasks.current) return; // Real subtasks from API take priority
    if (subtasks.length > 0 || steps.length === 0) return;
    const derived = deriveSubtasksFromSteps(steps);
    if (derived.length > 0) {
      setSubtasks(derived);
    }
  }, [steps, subtasks.length]);

  // Fetch execution data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(
          `/api/orchestrator/tasks/by-task/${taskId}/active`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setBackendUnavailable(json?.reason === "backend_unavailable");
          }
          if (!cancelled && json.ok && json.data) {
            const eid = json.data.execution_id;
            setExecutionId(eid);
            setExecution((prev) => {
              if (prev && prev.id === eid) return prev;
              return {
                id: eid,
                status: String(json.data.status || "in_progress"),
                total_tokens_used: 0,
                total_cost_usd: null,
                attempt_count: 1,
                started_at: null,
                completed_at: null,
                workspace_path: null,
                error_message: null,
              };
            });

            const detailPromise = fetch(`/api/orchestrator/tasks/${eid}`).catch(() => null);
            const previewPromise = fetch(`/api/orchestrator/preview/executions/${eid}`).catch(() => null);

            const [detailRes, previewRes] = await Promise.all([detailPromise, previewPromise]);

            if (detailRes?.ok) {
              const detail = await detailRes.json().catch(() => null);
              if (!cancelled && detail) setExecution(detail.data);
            }

            if (previewRes?.ok) {
              const preview = await previewRes.json().catch(() => null);
              // Only replace subtasks when the API returns a non-empty array.
              // Empty results (planning not done yet) should NOT clear derived subtasks.
              const apiSubtasks = preview?.data?.subtasks;
              if (!cancelled && Array.isArray(apiSubtasks) && apiSubtasks.length > 0) {
                hasApiSubtasks.current = true;
                setSubtasks(apiSubtasks);
                // Reset selection since real subtask IDs differ from derived ones
                setSelectedPhase(null);
              }
            }
          }
        }
      } catch {
        if (!cancelled) setBackendUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    // Poll faster while the agent is actively working so checklist/subtask state
    // and execution metadata stay fresh between SSE events.
    const needsSubtasks = !hasApiSubtasks.current;
    const isLivePhase = ["claimed", "in_progress"].includes(taskStatus);
    const pollMs = (taskStatus === "claimed" && !executionId)
      ? 4_000
      : isLivePhase
        ? (needsSubtasks ? 5_000 : 7_000)
        : 15_000;
    const interval = setInterval(fetchData, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId, taskStatus, executionId]);

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

  // ── Claimed but no execution yet (transitional state) ──
  if (taskStatus === "claimed" && !executionId && !loading && backendUnavailable) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="mb-1.5 text-sm font-semibold text-stone-700">Cannot load live activity</p>
        <p className="max-w-md text-xs leading-relaxed text-stone-500">
          Frontend cannot reach orchestrator endpoints. Set `NEXT_PUBLIC_API_URL` (and optionally
          `ORCHESTRATOR_API_URL`) on Vercel to your backend URL, then redeploy frontend.
        </p>
      </div>
    );
  }

  if (taskStatus === "claimed" && !executionId && !loading) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="relative mb-6">
          <div className="h-14 w-14 rounded-full border-4 border-red-100 border-t-[#E5484D] animate-spin" />
        </div>
        <p
          className="mb-2 text-2xl font-medium text-stone-700"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Claim accepted — spinning up&hellip;
        </p>
        <p className="max-w-md text-sm leading-relaxed text-stone-400">
          The agent has claimed your task and is preparing the execution environment.
          You&apos;ll see real-time progress here in a moment.
        </p>
      </div>
    );
  }

  if (loading && !executionId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center animate-pulse">
        <div className="mb-4 h-12 w-12 rounded-full border-4 border-stone-200 border-t-[#E5484D] animate-spin" />
        <p className="text-sm font-semibold text-stone-700">Loading activity...</p>
      </div>
    );
  }

  // ── Animated splash if no subtasks are ready yet and it is working ──
  const isFailed = execution?.status === "failed";
  const isWorking = ["claimed", "in_progress"].includes(taskStatus) && !isFailed;
  const hasProgressSteps = steps.length > 0;
  // Previously: `subtasks.length === 0 && steps.length < 3`. 
  // This caused the screen to go blank during triage/planning (steps >= 3 but no subtasks yet).
  // Now we wait until we actually have subtasks to show the roadmap.
  if (isWorking && subtasks.length === 0) {
    return (
      <AgentProcessingSplash
        currentPhase={currentPhase}
        latestDetail={hasProgressSteps ? (steps[steps.length - 1].detail || steps[steps.length - 1].description) : null}
        progressPct={progressPct}
        fading={false}
      />
    );
  }


  // ── Compute state ──
  const isActive = isWorking;
  const isComplete =
    execution?.status === "completed" ||
    taskStatus === "completed" ||
    taskStatus === "delivered";

  // Group steps by phase
  const phaseSteps = new Map<string, ProgressStep[]>();
  for (const step of steps) {
    const existing = phaseSteps.get(step.phase) || [];
    existing.push(step);
    phaseSteps.set(step.phase, existing);
  }

  // Elapsed time
  const startTime = execution?.started_at
    ? new Date(execution.started_at)
    : null;
  const endTime = execution?.completed_at
    ? new Date(execution.completed_at)
    : null;
  const elapsed = startTime
    ? (endTime || new Date()).getTime() - startTime.getTime()
    : 0;
  const elapsedStr =
    elapsed > 60000
      ? `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`
      : `${Math.floor(elapsed / 1000)}s`;

  // Auto-select current phase
  const activePhase =
    selectedPhase ??
    String(
      subtasks.find((s) => s.status === "in_progress")?.id ??
      subtasks[0]?.id ??
      ""
    );

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="a-fade mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isComplete
            ? "bg-emerald-100"
            : isFailed
              ? "bg-red-100"
              : "bg-[#FFF1F2]"
            }`}>
            {isComplete ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-emerald-600"><polyline points="20 6 9 17 4 12" /></svg>
            ) : isFailed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-red-500"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E5484D] opacity-40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E5484D]" />
              </span>
            )}
          </div>
          <div>
            <span className="text-sm font-semibold text-stone-800">
              {isComplete
                ? "Agent completed your task"
                : isFailed
                  ? "Execution failed"
                  : "Agent is working on your task"}
            </span>
            {connected && isActive && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-stone-400">
          {elapsed > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="font-medium text-stone-500">{elapsedStr}</span>
            </span>
          )}
          {execution?.total_tokens_used ? (
            <span className="rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-1 font-medium text-stone-500">{(execution.total_tokens_used / 1000).toFixed(1)}k tokens</span>
          ) : null}
        </div>
      </div>

      {/* ── Quest Progress ── */}
      <QuestProgress
        subtasks={subtasks}
        progressPct={progressPct}
        isComplete={isComplete}
        isFailed={isFailed}
      />

      {/* ── Journey Map + Detail split ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Interactive journey map */}
        <div className="lg:col-span-3">
          <JourneyMap
            subtasks={subtasks}
            selectedPhase={activePhase}
            onSelectPhase={setSelectedPhase}
            isActive={isActive}
            isComplete={isComplete}
            isFailed={isFailed}
          />
        </div>

        {/* Right: Checkpoint detail */}
        <div className="lg:col-span-2">
          <CheckpointDetail
            subtasks={subtasks}
            selectedPhase={activePhase}
            steps={steps}
            isComplete={isComplete}
          />
        </div>
      </div>

      {/* ── Subtasks ── */}
      {subtasks.length > 0 && (
        <SubtasksList subtasks={subtasks} />
      )}

      {/* ── Activity Log ── */}
      <ActivityLog
        steps={steps}
        isActive={isActive}
      />

      {/* ── Raw Terminal logs ── */}
      {executionId && (
        <RawLogs
          executionId={executionId}
          isActive={isActive}
        />
      )}

      {/* ── Error ── */}
      {execution?.error_message && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="mb-1 text-sm font-semibold text-red-700">Execution Failed</p>
          <p className="text-xs text-red-600">{execution.error_message}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QUEST PROGRESS BAR
   ═══════════════════════════════════════════════════════════ */

function QuestProgress({
  subtasks,
  progressPct,
  isComplete,
  isFailed,
}: {
  subtasks: SubtaskData[];
  progressPct: number;
  isComplete: boolean;
  isFailed: boolean;
}) {
  const totalSteps = subtasks.length;
  const completedSteps = subtasks.filter(s => s.status === "completed").length;

  return (
    <div className="a-fade rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
            Quest Progress
          </span>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${isComplete ? "bg-emerald-50 text-emerald-600" : isFailed ? "bg-red-50 text-red-600" : "bg-stone-50 text-stone-600"}`}>
          {Math.round(isComplete ? 100 : progressPct)}%
        </span>
      </div>

      <p
        className={`mb-4 text-sm font-semibold ${isComplete
          ? "text-emerald-600"
          : isFailed
            ? "text-red-600"
            : "text-stone-700"
          }`}
      >
        {isComplete
          ? `${totalSteps} of ${totalSteps} checkpoints completed!`
          : isFailed
            ? "Execution encountered an error"
            : `${completedSteps} of ${totalSteps} checkpoints completed`}
      </p>

      {/* Segmented progress */}
      <div className="flex gap-1.5">
        {subtasks.map((sub) => {
          const isDone = isComplete || sub.status === "completed";
          const isCurrent = sub.status === "in_progress" && !isComplete;

          return (
            <div
              key={sub.id}
              className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100"
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: isDone ? "100%" : isCurrent ? "50%" : "0%",
                  backgroundColor: isComplete || isDone
                    ? "#10b981"
                    : isFailed && isCurrent
                      ? "#ef4444"
                      : isCurrent
                        ? "#E5484D"
                        : "#e7e5e4",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   JOURNEY MAP — Interactive SVG with winding path
   ═══════════════════════════════════════════════════════════ */

/** Truncate a string to fit within maxLen characters */
function truncateLabel(text: string, maxLen = 16): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function JourneyMap({
  subtasks,
  selectedPhase,
  onSelectPhase,
  isActive,
  isFailed,
  isComplete,
}: {
  subtasks: SubtaskData[];
  selectedPhase: string;
  onSelectPhase: (key: string) => void;
  isActive: boolean;
  isFailed: boolean;
  isComplete: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Completed percentage derived from subtasks
  const completedCount = subtasks.filter(s => s.status === "completed").length;
  const progressPct = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  // SVG dimensions — extra horizontal padding so pills at x=150 or x=350 stay in view
  const W = 500;
  const H = Math.max(600, subtasks.length * 110 + 150);

  // Dynamically calculate checkpoints positions winding back and forth
  const checkpoints = useMemo(() => {
    return subtasks.map((_, i) => ({
      x: i % 2 !== 0 ? 345 : 155,
      y: 90 + i * 110,
    }));
  }, [subtasks]);

  // Build smooth bezier path
  const pathD = useMemo(() => {
    if (checkpoints.length === 0) return "";
    const pts = checkpoints;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = prev.x + (curr.x - prev.x) * 0.5;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [checkpoints]);


  // For the dashed completed trail we use a clip rect approach that actually works:
  // We draw the same dashed path but clip it to a rectangle covering the top N% of the SVG height
  const clipHeight = isComplete ? H : (progressPct / 100) * H;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-stone-200 bg-[#FAF9F7]"
      style={{ minHeight: 500 }}
    >
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
          <pattern id="jm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#jm-grid)" />
        </svg>
        <TreeDecoration x="8%" y="75%" size={0.7} />
        <TreeDecoration x="85%" y="60%" size={0.55} />
        <TreeDecoration x="15%" y="35%" size={0.6} />
        <TreeDecoration x="78%" y="25%" size={0.5} />
        <TreeDecoration x="45%" y="85%" size={0.45} />
        <TreeDecoration x="92%" y="42%" size={0.4} />
        <TreeDecoration x="5%" y="15%" size={0.5} />
        <TreeDecoration x="60%" y="55%" size={0.35} />
      </div>

      {/* SVG Layer */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative h-full w-full"
        style={{ minHeight: 420 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="jm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip for the progress fill path */}
          <clipPath id="jm-progress-clip">
            <rect
              x="0"
              y="0"
              width={W}
              height={clipHeight}
              style={{ transition: "height 1s ease-out" }}
            />
          </clipPath>

          {/* Per-node text clip paths — one rect per subtask */}
          {subtasks.map((sub) => (
            <clipPath key={`cp-${sub.id}`} id={`jm-text-clip-${sub.id}`}>
              {/* text area: from icon right edge (-44) to right side (72), centred at node translate */}
              <rect x="-44" y="-12" width="114" height="24" />
            </clipPath>
          ))}
        </defs>

        {/* Trail — background (full dashed, faded) */}
        <path
          d={pathD}
          fill="none"
          stroke="#d6d3d1"
          strokeWidth="4"
          strokeDasharray="12 8"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Trail — completed portion via SVG clipPath */}
        <path
          d={pathD}
          fill="none"
          stroke={isFailed ? "#ef4444" : "#10b981"}
          strokeWidth="4"
          strokeDasharray="12 8"
          strokeLinecap="round"
          clipPath="url(#jm-progress-clip)"
        />

        {/* Checkpoint nodes */}
        {subtasks.map((sub, i) => {
          const pt = checkpoints[i];
          const isDone = isComplete || sub.status === "completed";
          const isCurrent = sub.status === "in_progress" && !isComplete;
          const isSelected = String(sub.id) === selectedPhase;
          const label = truncateLabel(sub.title, 15);

          return (
            <g
              key={sub.id}
              className="cursor-pointer"
              onClick={() => onSelectPhase(String(sub.id))}
            >
              {/* Flag pole */}
              {(isDone || isCurrent) && (
                <g transform={`translate(${pt.x + 18}, ${pt.y - 42})`}>
                  <line x1="0" y1="0" x2="0" y2="38" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 0 0 L 14 5 L 0 10 Z" fill="#10b981" />
                </g>
              )}

              {/* Shadow ellipse */}
              <ellipse
                cx={pt.x}
                cy={pt.y + 14}
                rx="28"
                ry="7"
                fill="black"
                opacity="0.07"
              />

              {/* Pill container */}
              <g transform={`translate(${pt.x}, ${pt.y})`}>
                <rect
                  x="-78"
                  y="-15"
                  width="156"
                  height="30"
                  rx="15"
                  fill="white"
                  stroke={isSelected ? "#10b981" : "#e7e5e4"}
                  strokeWidth={isSelected ? "2" : "1"}
                  filter={isSelected ? "url(#jm-glow)" : "drop-shadow(0 2px 6px rgba(0,0,0,0.06))"}
                />

                {/* Status circle */}
                <circle
                  cx="-57"
                  cy="0"
                  r="10"
                  fill={isDone ? "#10b981" : isCurrent ? "#E5484D" : "#f5f5f4"}
                />
                {isDone && (
                  <path
                    d="M-61 0 L-58 3 L-53 -3"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {isCurrent && (
                  <circle cx="-57" cy="0" r="4" fill="white" />
                )}

                {/* Text — clipped to pill interior so it never overflows */}
                <g clipPath={`url(#jm-text-clip-${sub.id})`}>
                  <text
                    x="-40"
                    y="4"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fill={isDone ? "#059669" : isCurrent ? "#E5484D" : "#78716c"}
                  >
                    {label}
                  </text>
                </g>
              </g>

              {/* Pulse ring for active node — pure SVG animation */}
              {isCurrent && isActive && (
                <circle cx={pt.x - 57} cy={pt.y} r="10" fill="none" stroke="#E5484D" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHECKPOINT DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */

interface ParsedDescriptionItem {
  text: string;
  checked?: boolean;
}

/** Parse text into checklist/steps/plain text blocks for richer UI rendering. */
function parseDescriptionSteps(text: string): {
  type: "checklist" | "steps" | "text";
  items: ParsedDescriptionItem[];
} {
  if (!text) return { type: "text", items: [] };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const checklistItems: ParsedDescriptionItem[] = [];
  const stepItems: ParsedDescriptionItem[] = [];

  for (const line of lines) {
    const checklistMatch = line.match(/^(?:[-*]\s*)?\[(x|X|\s)\]\s+(.+)/);
    if (checklistMatch) {
      checklistItems.push({
        text: checklistMatch[2],
        checked: checklistMatch[1].toLowerCase() === "x",
      });
      continue;
    }

    const stepMatch = line.match(/^(?:\d+[\.\)]\s*|[-*]\s+)(.+)/);
    if (stepMatch) {
      stepItems.push({ text: stepMatch[1] });
    }
  }

  if (checklistItems.length >= 2) {
    return { type: "checklist", items: checklistItems };
  }

  if (stepItems.length >= 2) {
    return { type: "steps", items: stepItems };
  }

  return {
    type: "text",
    items: lines.map((line) => ({ text: line })),
  };
}

function CheckpointDetail({
  subtasks,
  selectedPhase,
  steps,
  isComplete,
}: {
  subtasks: SubtaskData[];
  selectedPhase: string;
  steps: ProgressStep[];
  isComplete: boolean;
}) {
  const activeSubtaskIndex = subtasks.findIndex((s) => String(s.id) === selectedPhase);
  const subtask = subtasks[activeSubtaskIndex];

  const isDone = !!subtask && (isComplete || subtask.status === "completed");
  const isCurrent = !!subtask && subtask.status === "in_progress" && !isComplete;
  const isPending = !isDone && !isCurrent;

  // Match progress steps to this subtask using multiple strategies:
  // 1. Direct subtask_id match (if the backend provides it)
  // 2. Phase name match (for derived subtasks where title = phase name)
  // 3. Order-based match for real subtasks (map subtask index to execution-phase steps)
  const phaseSteps = useMemo(() => {
    if (!subtask) return [];

    // Strategy 1: direct subtask_id match
    const byId = steps.filter((step) => step.subtask_id != null && String(step.subtask_id) === String(subtask.id));
    if (byId.length > 0) return byId;

    // Strategy 2: phase name match (for derived subtasks)
    const phaseKey = subtask.title.toLowerCase().replace(/\s+/g, "_");
    const byPhase = steps.filter((step) => step.phase === phaseKey);
    if (byPhase.length > 0) return byPhase;

    // Strategy 3: for real planning subtasks, distribute execution-phase steps
    // across subtasks proportionally based on order
    const executionSteps = steps.filter((s) => s.phase === "execution" || s.phase === "complex_execution");
    if (executionSteps.length > 0 && subtasks.length > 0) {
      // Check if this looks like a real subtask (not derived from phases)
      const derivedPhaseNames = new Set(["triage", "clarification", "planning", "execution", "complex_execution", "review", "deployment", "delivery", "failed"]);
      const isRealSubtask = !derivedPhaseNames.has(phaseKey);

      if (isRealSubtask) {
        const chunkSize = Math.ceil(executionSteps.length / subtasks.length);
        const start = activeSubtaskIndex * chunkSize;
        const end = Math.min(start + chunkSize, executionSteps.length);
        if (start < executionSteps.length) {
          return executionSteps.slice(start, end);
        }
      }
    }

    return [];
  }, [steps, subtask, subtasks, activeSubtaskIndex]);

  // Parse description into structured steps
  const descSteps = useMemo(
    () => parseDescriptionSteps(subtask?.description || ""),
    [subtask?.description],
  );

  if (!subtask) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Checkpoint header card ── */}
      <div className="a-fade rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {/* Status row */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isDone
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : isCurrent
                  ? "border-[#E5484D]/20 bg-[#FFF1F2] text-[#E5484D]"
                  : "border-stone-200 bg-stone-50 text-stone-500"
                }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isDone ? "bg-emerald-500" : isCurrent ? "bg-[#E5484D] animate-pulse" : "bg-stone-300"}`} />
              {isDone ? "Completed" : isCurrent ? "In Progress" : "Pending"}
            </span>
            <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
              {activeSubtaskIndex + 1}/{subtasks.length}
            </span>
          </div>
        </div>

        {/* Checkpoint title */}
        <h3 className="mb-5 font-[family-name:var(--font-display)] text-lg leading-snug text-stone-900">
          {subtask.title}
        </h3>

        {/* ── Implementation Plan ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
              Implementation Plan
            </p>
          </div>

          {descSteps.type !== "text" ? (
            <div className="space-y-2">
              {descSteps.items.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-4 py-3 transition-colors hover:border-stone-200"
                >
                  {descSteps.type === "checklist" ? (
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[9px] font-bold ${step.checked
                        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border-stone-300 bg-white text-stone-400"
                      }`}>
                      {step.checked ? "\u2713" : ""}
                    </span>
                  ) : (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-600">
                      {i + 1}
                    </span>
                  )}
                  <p className="text-sm leading-relaxed text-stone-700">{step.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
              {descSteps.items.map((line, i) => (
                <p key={i} className="text-sm leading-relaxed text-stone-700 mb-1 last:mb-0">
                  {line.text}
                </p>
              ))}
              {descSteps.items.length === 0 && (
                <p className="text-sm text-stone-400 italic">No description available yet</p>
              )}
            </div>
          )}
        </div>

        {/* ── Result ── */}
        {subtask.result && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-emerald-600">
                Result
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-sm leading-relaxed text-emerald-900 whitespace-pre-wrap">{subtask.result}</p>
            </div>
          </div>
        )}

        {/* ── Files changed ── */}
        {subtask.files_changed && subtask.files_changed.length > 0 && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">
                Files Changed
              </p>
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                {subtask.files_changed.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {subtask.files_changed.map((f: string, j: number) => (
                <span
                  key={j}
                  className="rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1 text-[11px] font-mono text-stone-600"
                >
                  {f.split("/").pop()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Completion banner ── */}
        {isDone && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-sm font-semibold text-emerald-800">Checkpoint completed successfully</span>
          </div>
        )}

        {/* ── Live thinking indicator ── */}
        {isCurrent && phaseSteps.length > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E5484D]/15 bg-[#FFF1F2]/60 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E5484D] opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E5484D]" />
            </span>
            <span className="text-xs leading-relaxed text-stone-600">
              {phaseSteps[phaseSteps.length - 1].description || phaseSteps[phaseSteps.length - 1].detail}
            </span>
          </div>
        )}
      </div>

      {/* ── Agent&apos;s Thinking Process ── */}
      {phaseSteps.length > 0 && (
        <div className="a-fade rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
              Agent&apos;s Thinking Process
            </p>
            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
              {phaseSteps.length}
            </span>
          </div>

          <div className="relative ml-1">
            {phaseSteps.map((step, i) => {
              const isLastStep = i === phaseSteps.length - 1;
              const dotColor = isLastStep && isCurrent
                ? "#E5484D"
                : isDone
                  ? "#10b981"
                  : "#d6d3d1";
              const lineColor = isDone ? "#d1fae5" : "#f5f5f4";

              return (
                <div key={i} className="flex gap-4 group">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center">
                    <div
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full ring-[3px] ring-white transition-transform group-hover:scale-110"
                      style={{ background: dotColor }}
                    />
                    {!isLastStep && (
                      <div
                        className="w-0.5 flex-1 rounded-full"
                        style={{ background: lineColor, minHeight: 28 }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-5 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800 leading-snug">
                      {step.title || step.description}
                    </p>
                    {step.detail && step.detail !== step.title && (
                      <p className="mt-1 text-xs leading-relaxed text-stone-500">
                        {step.detail}
                      </p>
                    )}
                    {step.metadata &&
                      Object.keys(step.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(step.metadata)
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded-lg border border-stone-100 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500"
                              >
                                {k}: {String(v)}
                              </span>
                            ))}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state for pending phases ── */}
      {isPending && phaseSteps.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-6 py-10 text-center">
          <div className="mb-3 mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-stone-400">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-stone-600">
            This checkpoint hasn&apos;t started yet
          </p>
          <p className="mt-1 text-xs text-stone-400">
            The agent will reach here after completing previous steps.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUBTASKS LIST
   ═══════════════════════════════════════════════════════════ */

function SubtasksList({ subtasks }: { subtasks: SubtaskData[] }) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = subtasks.filter((s) => s.status === "completed").length;

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-stone-50/50 rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 16h4M9 8h6"/></svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
            Execution Subtasks
          </p>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
            {completedCount}/{subtasks.length}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-6 py-4 space-y-2">
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/40 px-4 py-3 transition-all hover:border-stone-200 hover:bg-stone-50"
            >
              <div className="mt-0.5">
                <SubtaskStatusIcon status={sub.status} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-stone-700">
                  {sub.title}
                </span>
                {sub.description && (
                  <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">
                    {sub.description}
                  </p>
                )}
                {sub.files_changed && sub.files_changed.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sub.files_changed.slice(0, 4).map((f, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-stone-100 bg-white px-1.5 py-0.5 text-[10px] font-mono text-stone-500"
                      >
                        {f.split("/").pop()}
                      </span>
                    ))}
                    {sub.files_changed.length > 4 && (
                      <span className="rounded-lg border border-stone-100 bg-white px-1.5 py-0.5 text-[10px] text-stone-400">
                        +{sub.files_changed.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACTIVITY LOG
   ═══════════════════════════════════════════════════════════ */

function ActivityLog({
  steps,
  isActive,
}: {
  steps: ProgressStep[];
  isActive: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const recentActivity = steps.filter((s) => s.detail || s.description).slice(-12);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  if (recentActivity.length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          Activity Log
        </p>
        {isActive && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E5484D]" />
        )}
      </div>
      <div className="bg-[#1C1917]">
        <div
          ref={logRef}
          className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
        >
          {recentActivity.map((step, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="shrink-0 text-stone-500">{(() => {
                const raw = Number(step.timestamp);
                const date = Number.isFinite(raw)
                  ? new Date(raw > 1e12 ? raw : raw * 1000)
                  : new Date(step.timestamp);
                return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              })()}</span>
              <span className="shrink-0 text-stone-600 select-none">$</span>
              <span className="text-emerald-400/80">[{step.phase}]</span>
              <span className="text-stone-300">
                {step.detail || step.description}
              </span>
            </div>
          ))}
          {isActive && (
            <div className="flex items-center gap-1 py-0.5 text-stone-500">
              <span className="select-none">$</span>
              <span className="animate-pulse text-[#E5484D]">_</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DECORATIVE COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TreeDecoration({
  x,
  y,
  size = 1,
}: {
  x: string;
  y: string;
  size?: number;
}) {
  return (
    <div
      className="absolute"
      style={{ left: x, top: y, transform: `scale(${size})`, transformOrigin: "bottom center" }}
    >
      {/* Tree trunk */}
      <div
        className="mx-auto rounded-sm bg-amber-800/30"
        style={{ width: 4, height: 14 }}
      />
      {/* Tree crown */}
      <div
        className="rounded-full bg-emerald-500/15"
        style={{ width: 24, height: 22, marginTop: -6, marginLeft: -10 }}
      />
      <div
        className="rounded-full bg-emerald-600/10"
        style={{ width: 18, height: 16, marginTop: -18, marginLeft: -7 }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════ */

function SubtaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-emerald-600">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF1F2]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#E5484D]" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-red-500">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-stone-200">
      <span className="h-1.5 w-1.5 rounded-full bg-stone-200" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RAW LOGS VIEWER
   ═══════════════════════════════════════════════════════════ */

function RawLogs({
  executionId,
  isActive,
}: {
  executionId: number;
  isActive: boolean;
}) {
  const [logs, setLogs] = useState<string>("Loading raw logs...");
  const [expanded, setExpanded] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/orchestrator/tasks/${executionId}/logs`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.ok) {
            setLogs(json.data || "Logs are empty.");
          }
        }
      } catch {
        // Ignore
      }
    }

    fetchLogs();

    // Auto-refresh when active
    let interval: ReturnType<typeof setInterval>;
    if (isActive) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [executionId, isActive, expanded]);

  // Auto-scroll when logs change
  useEffect(() => {
    if (expanded && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-stone-50/50"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
            Internal Agent Logs
          </p>
          {isActive && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E5484D]" />
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 bg-[#1C1917]">
          <pre
            ref={logRef}
            className="p-4 text-xs font-mono text-stone-300 overflow-auto whitespace-pre-wrap leading-relaxed max-h-96"
          >
            {logs}
            {isActive && (
              <span className="animate-pulse text-[#E5484D]">_</span>
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
