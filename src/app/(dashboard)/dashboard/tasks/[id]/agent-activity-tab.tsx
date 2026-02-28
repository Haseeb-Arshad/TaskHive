"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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

  const { steps, currentPhase, progressPct, connected } =
    useExecutionProgress(executionId);

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
          if (!cancelled && json.ok && json.data) {
            const eid = json.data.execution_id;
            setExecutionId(eid);

            const detailPromise = fetch(`/api/orchestrator/tasks/${eid}`).catch(() => null);
            const previewPromise = fetch(`/api/orchestrator/preview/executions/${eid}`).catch(() => null);

            const [detailRes, previewRes] = await Promise.all([detailPromise, previewPromise]);

            if (detailRes?.ok) {
              const detail = await detailRes.json().catch(() => null);
              if (!cancelled && detail) setExecution(detail.data);
            }

            if (previewRes?.ok) {
              const preview = await previewRes.json().catch(() => null);
              if (!cancelled && preview?.data?.subtasks) {
                setSubtasks(preview.data.subtasks);
              }
            }
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

  if (loading && !executionId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center animate-pulse">
        <div className="mb-4 h-12 w-12 rounded-full border-4 border-stone-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-stone-700">Loading activity...</p>
      </div>
    );
  }

  // ── Animated splash if no subtasks are ready yet and it is working ──
  const isWorking = ["claimed", "in_progress"].includes(taskStatus);
  if (isWorking && subtasks.length === 0) {
    return (
      <AgentProcessingSplash
        currentPhase={currentPhase}
        latestDetail={steps.length > 0 ? (steps[steps.length - 1].detail || steps[steps.length - 1].description) : null}
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
  const isFailed = execution?.status === "failed";

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
    <div className="p-5">
      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${isComplete
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
        subtasks={subtasks}
        progressPct={progressPct}
        isComplete={isComplete}
        isFailed={isFailed}
      />

      {/* ── Journey Map + Detail split ── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
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
            isFailed={isFailed}
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
  const currentStepIdx = subtasks.findIndex(s => s.status === "in_progress");

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
        className={`mb-3 text-sm font-bold ${isComplete
          ? "text-emerald-600"
          : isFailed
            ? "text-red-600"
            : "text-stone-800"
          }`}
      >
        {isComplete
          ? `${totalSteps} of ${totalSteps} checkpoints completed!`
          : isFailed
            ? "Execution encountered an error"
            : `${completedSteps} of ${totalSteps} checkpoints completed`}
      </p>

      {/* Segmented progress */}
      <div className="flex gap-1">
        {subtasks.map((sub, i) => {
          const isDone = isComplete || sub.status === "completed";
          const isCurrent = sub.status === "in_progress" && !isComplete;

          return (
            <div
              key={sub.id}
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: isDone ? "100%" : isCurrent ? "50%" : "0%", // Simple 50% for in_progress steps
                  backgroundColor: isComplete || isDone
                    ? "#10b981"
                    : isFailed && isCurrent
                      ? "#ef4444"
                      : isCurrent
                        ? "#3b82f6"
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

  // SVG dimensions
  const W = 500;
  // Dynamic height based on number of tasks, min 600
  const H = Math.max(600, subtasks.length * 100 + 150);

  // Dynamically calculate checkpoints positions winding back and forth
  const checkpoints = useMemo(() => {
    return subtasks.map((_, i) => {
      const isRight = i % 2 !== 0;
      return {
        x: isRight ? 350 : 150, // Alternate left/right offset 
        y: 80 + (i * 100), // Move downward linearly 100px per node
      };
    });
  }, [subtasks]);

  // Build path
  const pathD = useMemo(() => {
    if (checkpoints.length === 0) return "";
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
      className="relative overflow-hidden rounded-2xl border border-stone-200 bg-[#f8fafc]"
      style={{ minHeight: 500 }}
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
          stroke={isComplete ? "#10b981" : isFailed ? "#ef4444" : "#10b981"}
          strokeWidth="4"
          strokeDasharray="12 8"
          strokeLinecap="round"
          style={{
            strokeDashoffset: 0,
            clipPath: `inset(0 0 ${isComplete ? 0 : Math.max(0, 100 - progressPct)}% 0)`,
            transition: "clip-path 1s ease-out",
          }}
        />

        {/* Checkpoint nodes */}
        {subtasks.map((sub, i) => {
          const pt = checkpoints[i];
          const isDone = isComplete || sub.status === "completed";
          const isCurrent = sub.status === "in_progress" && !isComplete;
          const isSelected = String(sub.id) === selectedPhase;

          return (
            <g
              key={sub.id}
              className="cursor-pointer"
              onClick={() => onSelectPhase(String(sub.id))}
              style={{ transition: "transform 0.3s" }}
            >
              {/* Flag pole (if completed or active) */}
              {(isDone || isCurrent) && (
                <g transform={`translate(${pt.x + 20}, ${pt.y - 45})`}>
                  <line x1="0" y1="0" x2="0" y2="40" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 0 0 L 16 6 L 0 12 Z" fill="#10b981" />
                </g>
              )}

              {/* Base platform shadow */}
              <ellipse
                cx={pt.x}
                cy={pt.y + 12}
                rx="24"
                ry="8"
                fill="black"
                opacity="0.1"
              />

              {/* The Pill Label (The main interactable node) */}
              <g transform={`translate(${pt.x}, ${pt.y})`}>
                <rect
                  x="-75"
                  y="-14"
                  width="150"
                  height="28"
                  rx="14"
                  fill="white"
                  stroke={isSelected ? "#10b981" : "#e7e5e4"}
                  strokeWidth={isSelected ? "2" : "1"}
                  filter={isSelected ? "url(#glow)" : "drop-shadow(0 4px 6px rgba(0,0,0,0.05))"}
                  className="transition-all duration-300"
                />

                {/* Status Icon Indicator inside pill */}
                <circle cx="-56" cy="0" r="10" fill={isDone || isCurrent ? "#10b981" : "#f5f5f4"} />
                {isDone || isCurrent ? (
                  <path d="M-60 0 L-57 3 L-52 -3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                ) : null}

                {/* Text Label */}
                <text
                  x="-35"
                  y="4"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  fill={isDone || isCurrent ? "#059669" : "#78716c"}
                >
                  <tspan className="truncate">{sub.title}</tspan>
                </text>
              </g>

              {/* Pulse effect if it's the current active working phase */}
              {isCurrent && isActive && (
                <circle cx={pt.x - 56} cy={pt.y} r="10" fill="none" stroke="#10b981" strokeWidth="2" className="animate-ping origin-center" />
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

function CheckpointDetail({
  subtasks,
  selectedPhase,
  steps,
  isComplete,
  isFailed,
  isActive,
}: {
  subtasks: SubtaskData[];
  selectedPhase: string;
  steps: ProgressStep[];
  isComplete: boolean;
  isFailed: boolean;
  isActive: boolean;
}) {
  const activeSubtaskIndex = subtasks.findIndex((s) => String(s.id) === selectedPhase);
  const subtask = subtasks[activeSubtaskIndex];

  if (!subtask) return null;

  const isDone = isComplete || subtask.status === "completed";
  const isCurrent = subtask.status === "in_progress" && !isComplete;
  const isPending = !isDone && !isCurrent;

  // Filter steps tied specifically to this subtask
  const phaseSteps = steps.filter((step) => String(step.subtask_id) === String(subtask.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Phase header card (Like the reference image's checkpoint boxes) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${isDone
              ? "bg-emerald-500 text-white"
              : isCurrent
                ? "bg-blue-500 text-white"
                : "bg-stone-200 text-stone-500"
              }`}
          >
            {isDone ? "Completed" : isCurrent ? "In Progress" : "Pending"}
          </span>
          {isDone && (
            <span className="text-xs text-stone-400">
              {/* Just a mock date like the reference */}
              <svg xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Today
            </span>
          )}
        </div>

        <h3 className="mb-4 text-base font-bold text-stone-800">
          Checkpoint {activeSubtaskIndex + 1}: {subtask.title}
        </h3>

        {/* Mock perks/details list like the image reference */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2H5l-2-2m20 9l-2 2H5L3 11m20 9l-2 2H5l-2-2M12 2v20 M7 2v20 M17 2v20" /></svg>
            Review Checkpoint Details
          </div>

          <div className="text-xs text-stone-500 bg-white border border-stone-100 p-3 rounded-lg leading-relaxed">
            {subtask.description}
          </div>

          {isDone && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 font-medium mt-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
              {subtask.title} Phase Successfully Cleared!
            </div>
          )}
        </div>

        {/* Thinking / status text */}
        {isCurrent && phaseSteps.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 border border-stone-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            <span className="animate-pulse">{phaseSteps[phaseSteps.length - 1].description || phaseSteps[phaseSteps.length - 1].detail}</span>
          </div>
        )}
      </div>

      {/* Steps timeline */}
      {phaseSteps.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
            Agent&apos;s Thinking Process
          </p>
          <div className="space-y-0">
            {phaseSteps.map((step, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        i === phaseSteps.length - 1 && isCurrent
                          ? "#3b82f6"
                          : isDone
                            ? "#10b981"
                            : "#d6d3d1",
                    }}
                  />
                  {i < phaseSteps.length - 1 && (
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
      <div className="rounded-xl border border-stone-200 bg-white p-4 mt-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
          Subtask Scope
        </p>
        <div className="space-y-2">
          <div
            key={subtask.id}
            className="flex items-start gap-2 rounded-lg border border-stone-100 px-3 py-2.5 transition-colors bg-stone-50"
          >
            <SubtaskStatusIcon status={subtask.status} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-stone-700">
                {subtask.title}
              </p>
              {subtask.files_changed && subtask.files_changed.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {subtask.files_changed.slice(0, 3).map((f: string, j: number) => (
                    <span
                      key={j}
                      className="rounded bg-white px-1 py-0.5 text-[9px] font-mono text-stone-500 border border-stone-100"
                    >
                      {f.split("/").pop()}
                    </span>
                  ))}
                  {subtask.files_changed.length > 3 && (
                    <span className="text-[9px] text-stone-400 font-medium">
                      +{subtask.files_changed.length - 3} files
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
