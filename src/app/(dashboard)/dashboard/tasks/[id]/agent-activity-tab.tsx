"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useExecutionProgress } from "@/hooks/use-execution-progress";
import type { ProgressStep } from "@/hooks/use-execution-progress";
import { API_BASE_URL } from "@/lib/api-client";

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

/* ═══════════════════════════════════════════════════════════
   PHASE CONFIG
   ═══════════════════════════════════════════════════════════ */

const PHASES = [
  {
    key: "triage",
    label: "Triage",
    fullLabel: "Task Analysis",
    desc: "Reading & analyzing task requirements",
    icon: "search",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    key: "clarification",
    label: "Clarify",
    fullLabel: "Clarification",
    desc: "Checking if questions are needed",
    icon: "chat",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    key: "planning",
    label: "Plan",
    fullLabel: "Execution Plan",
    desc: "Creating step-by-step strategy",
    icon: "plan",
    color: "#0ea5e9",
    bg: "#f0f9ff",
  },
  {
    key: "execution",
    label: "Execute",
    fullLabel: "Code Execution",
    desc: "Writing code & building files",
    icon: "code",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  {
    key: "review",
    label: "Review",
    fullLabel: "Quality Check",
    desc: "Verifying quality & correctness",
    icon: "check",
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    key: "delivery",
    label: "Deliver",
    fullLabel: "Delivery",
    desc: "Submitting final deliverables",
    icon: "package",
    color: "#E5484D",
    bg: "#fff1f2",
  },
];

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

const DOT_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#8b5cf6", "#6366f1"];

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
      className={`flex flex-col items-center justify-center px-6 py-20 text-center transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
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
            stroke={currentPhase === "execution" ? "#f59e0b" : "#6366f1"}
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
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
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
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  const { steps, currentPhase, progressPct, connected } =
    useExecutionProgress(executionId);

  // Transition: splash → journey map when enough progress
  useEffect(() => {
    if (!showSplash) return;
    const shouldTransition = progressPct >= 25 || steps.length >= 4;
    if (shouldTransition) {
      setSplashFading(true);
      const timer = setTimeout(() => setShowSplash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [progressPct, steps.length, showSplash]);

  // Skip splash entirely for completed/delivered/failed tasks
  useEffect(() => {
    if (["completed", "delivered"].includes(taskStatus)) {
      setShowSplash(false);
    }
  }, [taskStatus]);

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

            try {
              const detailRes = await fetch(
                `${API_BASE_URL}/orchestrator/tasks/${eid}`
              );
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (!cancelled) setExecution(detail.data);
              }
            } catch { /* ignore */ }

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
    const interval = setInterval(fetchData, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

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

  // ── Splash: while loading OR during early phases ──
  if (loading && showSplash) {
    return (
      <AgentProcessingSplash
        currentPhase={null}
        latestDetail={null}
        progressPct={0}
        fading={false}
      />
    );
  }

  if (!executionId && !loading) {
    // No execution yet but task is claimed — show splash with generic message
    if (showSplash && ["claimed", "in_progress"].includes(taskStatus)) {
      return (
        <AgentProcessingSplash
          currentPhase={null}
          latestDetail="The orchestrator is picking up your task\u2026"
          progressPct={0}
          fading={false}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-1 text-sm font-semibold text-stone-700">No execution data</p>
        <p className="text-xs text-stone-400">
          Agent activity will appear here once the orchestrator starts processing.
        </p>
      </div>
    );
  }

  // ── Splash with live SSE data (early phases) ──
  if (executionId && showSplash) {
    const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;
    return (
      <AgentProcessingSplash
        currentPhase={currentPhase}
        latestDetail={latestStep?.detail || latestStep?.description || null}
        progressPct={progressPct}
        fading={splashFading}
      />
    );
  }

  // ── Compute state ──
  const isActive = ["claimed", "in_progress"].includes(taskStatus);
  const isComplete =
    execution?.status === "completed" ||
    taskStatus === "completed" ||
    taskStatus === "delivered";
  const isFailed = execution?.status === "failed";

  // Group steps by phase
  const phaseSteps = new Map<string, ProgressStep[]>();
  for (const step of steps) {
    const existing = phaseSteps.get(step.phase) || [];
    existing.push(step);
    phaseSteps.set(step.phase, existing);
  }

  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);
  const completedPhases = isComplete
    ? PHASES.length
    : currentIdx >= 0
      ? currentIdx
      : 0;

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
  const activePhase = selectedPhase ?? currentPhase ?? PHASES[0].key;

  return (
    <div className="p-5">
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {elapsedStr}
            </span>
          )}
          {execution?.total_tokens_used ? (
            <span>{(execution.total_tokens_used / 1000).toFixed(1)}k tokens</span>
          ) : null}
        </div>
      </div>

      {/* ── Quest Progress ── */}
      <QuestProgress
        completedPhases={completedPhases}
        totalPhases={PHASES.length}
        progressPct={isComplete ? 100 : progressPct}
        isComplete={isComplete}
        isFailed={isFailed}
      />

      {/* ── Journey Map + Detail split ── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Left: Interactive journey map */}
        <div className="lg:col-span-3">
          <JourneyMap
            phases={PHASES}
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            isComplete={isComplete}
            isFailed={isFailed}
            selectedPhase={activePhase}
            onSelectPhase={setSelectedPhase}
            phaseSteps={phaseSteps}
            isActive={isActive}
            progressPct={isComplete ? 100 : progressPct}
          />
        </div>

        {/* Right: Checkpoint detail */}
        <div className="lg:col-span-2">
          <CheckpointDetail
            phase={PHASES.find((p) => p.key === activePhase) || PHASES[0]}
            phaseIndex={PHASES.findIndex((p) => p.key === activePhase)}
            steps={phaseSteps.get(activePhase) || []}
            subtasks={subtasks}
            isComplete={isComplete}
            isFailed={isFailed}
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            isActive={isActive}
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
  completedPhases,
  totalPhases,
  progressPct,
  isComplete,
  isFailed,
}: {
  completedPhases: number;
  totalPhases: number;
  progressPct: number;
  isComplete: boolean;
  isFailed: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
          Quest Progress
        </span>
        <span className="text-xs font-semibold text-stone-500">
          {Math.round(isComplete ? 100 : progressPct)}%
        </span>
      </div>

      <p
        className={`mb-3 text-sm font-bold ${
          isComplete
            ? "text-emerald-600"
            : isFailed
              ? "text-red-600"
              : "text-stone-800"
        }`}
      >
        {isComplete
          ? `${totalPhases} of ${totalPhases} checkpoints completed!`
          : isFailed
            ? "Execution encountered an error"
            : `${completedPhases} of ${totalPhases} checkpoints completed`}
      </p>

      {/* Segmented progress */}
      <div className="flex gap-1">
        {PHASES.map((phase, i) => (
          <div
            key={phase.key}
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width:
                  i < completedPhases
                    ? "100%"
                    : i === completedPhases && !isComplete
                      ? `${Math.max(((progressPct - (completedPhases / PHASES.length) * 100) / (100 / PHASES.length)) * 100, 8)}%`
                      : "0%",
                backgroundColor: isComplete
                  ? "#10b981"
                  : isFailed && i === completedPhases
                    ? "#ef4444"
                    : phase.color,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   JOURNEY MAP — Interactive SVG with winding path
   ═══════════════════════════════════════════════════════════ */

function JourneyMap({
  phases,
  currentPhase,
  completedPhases,
  isComplete,
  isFailed,
  selectedPhase,
  onSelectPhase,
  phaseSteps,
  isActive,
  progressPct,
}: {
  phases: typeof PHASES;
  currentPhase: string | null;
  completedPhases: number;
  isComplete: boolean;
  isFailed: boolean;
  selectedPhase: string;
  onSelectPhase: (key: string) => void;
  phaseSteps: Map<string, ProgressStep[]>;
  isActive: boolean;
  progressPct: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG dimensions
  const W = 600;
  const H = 520;
  const PAD = 60;

  // Checkpoint positions — winding path from bottom to top
  const checkpoints = useMemo(() => [
    { x: PAD + 40,  y: H - 60  },   // Triage (bottom-left)
    { x: W - PAD - 40, y: H - 150 }, // Clarify (right)
    { x: PAD + 80,  y: H - 240 },    // Plan (left)
    { x: W - PAD - 60, y: H - 310 }, // Execute (right)
    { x: PAD + 60,  y: H - 390 },    // Review (left)
    { x: W / 2,     y: 50  },        // Deliver (top-center)
  ], []);

  // Build path
  const pathD = useMemo(() => {
    const pts = checkpoints;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
      const cpy1 = prev.y;
      const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
      const cpy2 = curr.y;
      d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [checkpoints]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-b from-emerald-50/40 via-green-50/20 to-amber-50/30"
      style={{ minHeight: 420 }}
    >
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Decorative trees */}
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
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pulse animation */}
          <filter id="pulse-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Trail path — background */}
        <path
          d={pathD}
          fill="none"
          stroke="#d6d3d1"
          strokeWidth="4"
          strokeDasharray="12 8"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Trail path — completed portion */}
        <path
          d={pathD}
          fill="none"
          stroke={isComplete ? "#10b981" : isFailed ? "#ef4444" : "#E5484D"}
          strokeWidth="4"
          strokeDasharray="12 8"
          strokeLinecap="round"
          style={{
            strokeDashoffset: 0,
            clipPath: `inset(${
              isComplete
                ? 0
                : Math.max(0, 100 - (progressPct * 1.1))
            }% 0 0 0)`,
            transition: "clip-path 1s ease-out",
          }}
        />

        {/* Checkpoint nodes */}
        {phases.map((phase, i) => {
          const pt = checkpoints[i];
          const isDone = isComplete || i < completedPhases;
          const isCurrent = phase.key === currentPhase && !isComplete;
          const isSelected = phase.key === selectedPhase;
          const hasSteps = phaseSteps.has(phase.key);

          return (
            <g
              key={phase.key}
              className="cursor-pointer"
              onClick={() => onSelectPhase(phase.key)}
              style={{ transition: "transform 0.3s" }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="32"
                  fill="none"
                  stroke={isDone ? "#10b981" : isCurrent ? "#E5484D" : phase.color}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.6"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`0 ${pt.x} ${pt.y}`}
                    to={`360 ${pt.x} ${pt.y}`}
                    dur="12s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Outer glow for current */}
              {isCurrent && isActive && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="28"
                  fill="#E5484D"
                  opacity="0.15"
                >
                  <animate
                    attributeName="r"
                    values="28;36;28"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.15;0.05;0.15"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Main circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="24"
                fill={
                  isDone
                    ? "#10b981"
                    : isCurrent
                      ? "#E5484D"
                      : hasSteps
                        ? "#f5f5f4"
                        : "#fafaf9"
                }
                stroke={
                  isDone
                    ? "#059669"
                    : isCurrent
                      ? "#dc2626"
                      : isSelected
                        ? phase.color
                        : "#d6d3d1"
                }
                strokeWidth={isSelected ? 3 : 2}
                filter={isCurrent ? "url(#glow)" : undefined}
              />

              {/* Icon */}
              {isDone ? (
                <g transform={`translate(${pt.x - 8}, ${pt.y - 8})`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </g>
              ) : (
                <g transform={`translate(${pt.x - 8}, ${pt.y - 8})`}>
                  <PhaseIconSVG
                    phase={phase.icon}
                    color={isCurrent ? "white" : hasSteps ? "#78716c" : "#d6d3d1"}
                  />
                </g>
              )}

              {/* Flag on top */}
              {(isDone || isCurrent) && (
                <g transform={`translate(${pt.x + 14}, ${pt.y - 30})`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="18"
                    stroke="#78716c"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 0 0 L 14 4 L 0 8 Z"
                    fill={isDone ? "#10b981" : "#E5484D"}
                  />
                </g>
              )}

              {/* Label bubble */}
              <g transform={`translate(${pt.x}, ${pt.y + 34})`}>
                <rect
                  x={-phase.label.length * 4.2 - 10}
                  y="-10"
                  width={phase.label.length * 8.4 + 20}
                  height="22"
                  rx="11"
                  fill={
                    isDone
                      ? "#ecfdf5"
                      : isCurrent
                        ? "#fff1f2"
                        : "white"
                  }
                  stroke={
                    isDone
                      ? "#a7f3d0"
                      : isCurrent
                        ? "#fecdd3"
                        : "#e7e5e4"
                  }
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  y="3"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                  fill={
                    isDone
                      ? "#059669"
                      : isCurrent
                        ? "#E5484D"
                        : "#78716c"
                  }
                >
                  {isDone ? "\u2713 " : ""}
                  {phase.label}
                </text>
              </g>
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

function CheckpointDetail({
  phase,
  phaseIndex,
  steps,
  subtasks,
  isComplete,
  isFailed,
  currentPhase,
  completedPhases,
  isActive,
}: {
  phase: (typeof PHASES)[number];
  phaseIndex: number;
  steps: ProgressStep[];
  subtasks: SubtaskData[];
  isComplete: boolean;
  isFailed: boolean;
  currentPhase: string | null;
  completedPhases: number;
  isActive: boolean;
}) {
  const isDone = isComplete || phaseIndex < completedPhases;
  const isCurrent = phase.key === currentPhase && !isComplete;
  const isPending = !isDone && !isCurrent;

  // Get relevant subtasks for "planning" and "execution" phases
  const phaseSubtasks =
    phase.key === "planning" || phase.key === "execution" ? subtasks : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Phase header card */}
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: isDone
            ? "#a7f3d0"
            : isCurrent
              ? phase.color + "40"
              : "#e7e5e4",
          background: isDone
            ? "#ecfdf5"
            : isCurrent
              ? phase.bg
              : "white",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: isDone ? "#10b981" : isCurrent ? phase.color : "#e7e5e4",
              }}
            >
              <PhaseIconInline phase={phase.icon} white={isDone || isCurrent} />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">
                Checkpoint {phaseIndex + 1}: {phase.fullLabel}
              </p>
              <p className="text-[11px] text-stone-500">{phase.desc}</p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isDone
                ? "bg-emerald-100 text-emerald-700"
                : isCurrent
                  ? "bg-white/80 text-stone-700"
                  : "bg-stone-100 text-stone-400"
            }`}
          >
            {isDone ? "Completed" : isCurrent ? "In Progress" : "Pending"}
          </span>
        </div>

        {/* Thinking / status text */}
        {isCurrent && steps.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs text-stone-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E5484D]" />
            {steps[steps.length - 1].description || steps[steps.length - 1].detail}
          </div>
        )}
      </div>

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
            Agent&apos;s Thinking Process
          </p>
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        i === steps.length - 1 && isCurrent
                          ? phase.color
                          : isDone
                            ? "#10b981"
                            : "#d6d3d1",
                    }}
                  />
                  {i < steps.length - 1 && (
                    <div
                      className="w-px flex-1"
                      style={{
                        background: isDone ? "#a7f3d0" : "#e7e5e4",
                        minHeight: 20,
                      }}
                    />
                  )}
                </div>
                {/* Content */}
                <div className="pb-3 min-w-0">
                  <p className="text-xs font-semibold text-stone-700">
                    {step.title || step.description}
                  </p>
                  {step.detail && step.detail !== step.title && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
                      {step.detail}
                    </p>
                  )}
                  {step.metadata &&
                    Object.keys(step.metadata).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(step.metadata)
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500"
                            >
                              {k}: {String(v)}
                            </span>
                          ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase subtasks (for Plan / Execute) */}
      {phaseSubtasks.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
            {phase.key === "planning" ? "Planned Steps" : "Execution Tasks"}
          </p>
          <div className="space-y-2">
            {phaseSubtasks.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start gap-2 rounded-lg border border-stone-100 px-3 py-2.5 transition-colors hover:bg-stone-50"
              >
                <SubtaskStatusIcon status={sub.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-stone-700">
                    {sub.title}
                  </p>
                  {sub.files_changed && sub.files_changed.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sub.files_changed.slice(0, 3).map((f, j) => (
                        <span
                          key={j}
                          className="rounded bg-stone-100 px-1 py-0.5 text-[9px] font-mono text-stone-500"
                        >
                          {f.split("/").pop()}
                        </span>
                      ))}
                      {sub.files_changed.length > 3 && (
                        <span className="text-[9px] text-stone-400">
                          +{sub.files_changed.length - 3}
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

      {/* Empty state for pending phases */}
      {isPending && steps.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-8 text-center">
          <p className="text-xs text-stone-400">
            This checkpoint hasn&apos;t started yet.
          </p>
          <p className="mt-1 text-[11px] text-stone-300">
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
    <div className="mt-5 rounded-xl border border-stone-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
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
          className={`h-4 w-4 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-5 py-3 space-y-2">
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-start gap-3 rounded-xl border border-stone-100 px-4 py-3 transition-colors hover:border-stone-200"
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
                        className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-500"
                      >
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
    <div className="mt-5">
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
              <span className="text-stone-300">
                {step.detail || step.description}
              </span>
            </div>
          ))}
          {isActive && (
            <div className="flex items-center gap-1 py-0.5 text-stone-500">
              <span className="select-none">$</span>
              <span className="animate-pulse">_</span>
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

function PhaseIconSVG({ phase, color }: { phase: string; color: string }) {
  const props = {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (phase) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "plan":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "code":
      return (
        <svg {...props}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "package":
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

function PhaseIconInline({ phase, white }: { phase: string; white: boolean }) {
  const color = white ? "white" : "#78716c";
  return (
    <div className="flex h-4 w-4 items-center justify-center">
      <PhaseIconSVG phase={phase} color={color} />
    </div>
  );
}
