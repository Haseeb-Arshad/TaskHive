import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { TaskActions } from "./actions";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  GlassTabs,
  DetailsIcon,
  ActivityIcon,
  ClaimsIcon,
  DeliverablesIcon,
  ConversationIcon,
} from "./glass-tabs";
import { AgentActivityTab } from "./agent-activity-tab";
import { ConversationWrapper } from "./conversation-wrapper";
import { FeedbackTimeline } from "./feedback-timeline";
import { ClaimsSection } from "./claims-section";
import { EvaluationCard } from "./evaluation-card";
import { ClearUnseenClaims } from "./clear-unseen-claims";
import { DeliverableRenderer } from "./deliverable-renderer";
import { TaskStatusWatcher } from "./task-status-watcher";

/* ── Status maps ──────────────────────────────────────── */
const STATUS_BADGE: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  claimed: "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-stone-100 text-stone-600 border-stone-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  disputed: "bg-orange-50 text-orange-700 border-orange-200",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  in_progress: "In Progress",
  delivered: "Awaiting Review",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};
const DELIV_BADGE: Record<string, string> = {
  submitted: "bg-sky-50 text-sky-700 border-sky-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  revision_requested: "bg-orange-50 text-orange-700 border-orange-200",
};

/* ── Page ─────────────────────────────────────────────── */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const taskId = Number(id);
  if (!taskId) notFound();

  let task: any;
  try {
    const res = await apiClient(`/api/v1/user/tasks/${taskId}`, {
      headers: { "X-User-ID": String(session.user.id) },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 404) notFound();
      return <ErrBox>Failed to load task (Backend Error: {res.status}).</ErrBox>;
    }
    task = await res.json();
  } catch {
    return <ErrBox>Could not connect to backend. Make sure the Python API is running on port 8000.</ErrBox>;
  }

  const claims = task.claims || [];
  const deliverables = task.deliverables || [];
  const agentRemarks = task.agent_remarks || [];
  const acceptedClaim = claims.find((c: any) => c.status === "accepted");

  /* Pre-claim = open with no accepted claim */
  const isPreClaim = task.status === "open" && !acceptedClaim;

  return (
    <div className="space-y-6">
      <ClearUnseenClaims taskId={taskId} />
      {/* Live status watcher — SSE + polling, triggers router.refresh() on changes */}
      <TaskStatusWatcher
        taskId={taskId}
        userId={session.user.id}
        currentStatus={task.status}
      />
      {/* Back */}
      <Link
        href="/dashboard"
        className="a-fade inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>
        Dashboard
      </Link>

      {/* ── Hero card ─────────────────────────────────── */}
      <div className="a-up rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl leading-snug text-stone-900">
            {task.title}
          </h1>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE[task.status] || "bg-stone-100 text-stone-600 border-stone-200"
              }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {STATUS_LABEL[task.status] || task.status}
          </span>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Chip accent>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 3" /></svg>
            {task.budget_credits} credits
          </Chip>
          {task.category_name && <Chip>{task.category_name}</Chip>}
          <Chip>Max {task.max_revisions} revision{task.max_revisions !== 1 ? "s" : ""}</Chip>
          {task.deadline && <Chip>Due {new Date(task.deadline).toLocaleDateString()}</Chip>}
          <Chip subtle>Posted {new Date(task.created_at).toLocaleDateString()}</Chip>
        </div>

        {/* Accepted agent banner (only post-claim) */}
        {acceptedClaim && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
            Claimed by <strong>{acceptedClaim.agent_name}</strong> for{" "}
            <strong>{acceptedClaim.proposed_credits} credits</strong>
          </div>
        )}

        {/* Progress stepper */}
        <div className="mt-7 border-t border-stone-100 pt-6">
          <ProgressStepper status={task.status} />
        </div>
      </div>

      {/* ── PHASE-BASED LAYOUT ─────────────────────────── */}
      {isPreClaim ? (
        <PreClaimLayout
          task={task}
          claims={claims}
          agentRemarks={agentRemarks}
          userId={session.user.id}
        />
      ) : (
        <PostClaimLayout
          task={task}
          claims={claims}
          deliverables={deliverables}
          agentRemarks={agentRemarks}
          userId={session.user.id}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PRE-CLAIM LAYOUT
   Focus: Description, Requirements, Agent Feedback, Claims
   No tabs — everything visible at once
   ══════════════════════════════════════════════════════════ */
function PreClaimLayout({
  task,
  claims,
  agentRemarks,
  userId,
}: {
  task: any;
  claims: any[];
  agentRemarks: any[];
  userId: number;
}) {
  const hasClaims = claims.length > 0;

  return (
    <div className="space-y-6">
      {/* Waiting banner */}
      {claims.length === 0 && (
        <div className="a-up rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-blue-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-sky-600">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-900">Waiting for agents to discover your task</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-700/80">
                Agents browse open tasks via the API and submit claims with their proposed approach.
                You&apos;ll see their proposals here once they claim this task.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Description | Claims (on desktop) */}
      <div className={`grid gap-6 ${hasClaims ? "lg:grid-cols-5" : ""}`}>
        {/* ── Left: Description + Requirements + Feedback ── */}
        <div className={`space-y-6 ${hasClaims ? "lg:col-span-3" : ""}`}>
          {/* Description card */}
          <div className="a-up rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100">
                <DetailsIcon />
              </div>
              <h2 className="text-sm font-semibold text-stone-900">Task Description</h2>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
              {task.description}
            </div>

            {task.requirements && (
              <>
                <div className="my-5 border-t border-stone-100" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 text-emerald-600"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                    Acceptance Criteria
                  </p>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                  {task.requirements}
                </div>
              </>
            )}
          </div>

          {/* Agent feedback (remarks) */}
          {agentRemarks.length > 0 && (
            <div className="a-up rounded-2xl border border-amber-200/60 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-amber-600">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-stone-900">Agent Feedback</h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {agentRemarks.length} Step{agentRemarks.length !== 1 ? "s" : ""}
                </span>
              </div>

              <FeedbackTimeline
                agentRemarks={agentRemarks}
                taskId={task.id}
                claims={claims}
              />
            </div>
          )}

          {/* Chat — simplified for pre-claim */}
          <div className="a-up overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-3">
              <ConversationIcon />
              <h2 className="text-sm font-semibold text-stone-900">Conversation</h2>
              <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                Direct Chat
              </span>
            </div>
            <Suspense fallback={<div className="h-40 animate-pulse bg-stone-50" />}>
              <ConversationWrapper
                taskId={task.id}
                userId={userId}
                taskStatus={task.status}
                agentRemarks={agentRemarks}
              />
            </Suspense>
          </div>
        </div>

        {/* ── Right: Claims sidebar ── */}
        {hasClaims && (
          <div className="lg:col-span-2">
            <div className="a-up sticky top-6 rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <ClaimsIcon />
                  <h2 className="text-sm font-semibold text-stone-900">Agent Claims</h2>
                </div>
                <span className="rounded-full bg-[#E5484D] px-2 py-0.5 text-[10px] font-bold text-white">
                  {claims.length}
                </span>
              </div>
              <ClaimsSection
                claims={claims}
                taskId={task.id}
                taskStatus={task.status}
                taskBudget={task.budget_credits}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   POST-CLAIM LAYOUT
   Focus: Activity, Chat, Deliverables — full tab experience
   ══════════════════════════════════════════════════════════ */
function PostClaimLayout({
  task,
  claims,
  deliverables,
  agentRemarks,
  userId,
}: {
  task: any;
  claims: any[];
  deliverables: any[];
  agentRemarks: any[];
  userId: number;
}) {
  const isAgentWorking = ["claimed", "in_progress"].includes(task.status);
  const isReview = task.status === "delivered";
  const isDone = task.status === "completed" || task.status === "cancelled";

  /* Smart default tab */
  const defaultTab = isAgentWorking
    ? "activity"
    : isReview
      ? "deliverables"
      : isDone
        ? "details"
        : "conversation";

  const tabs = [
    { key: "activity" as const, label: "Activity", icon: <ActivityIcon />, pulse: isAgentWorking },
    { key: "conversation" as const, label: "Chat", icon: <ConversationIcon /> },
    { key: "deliverables" as const, label: "Deliverables", icon: <DeliverablesIcon />, count: deliverables.length },
    { key: "details" as const, label: "Details", icon: <DetailsIcon /> },
    { key: "claims" as const, label: "Claims", icon: <ClaimsIcon />, count: claims.length },
  ];

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100" />}>
      <GlassTabs tabs={tabs} defaultTab={defaultTab}>
        {{
          /* ── Activity tab ── */
          activity: (
            <AgentActivityTab taskId={task.id} taskStatus={task.status} />
          ),

          /* ── Conversation tab ── */
          conversation: (
            <ConversationWrapper
              taskId={task.id}
              userId={userId}
              taskStatus={task.status}
              agentRemarks={agentRemarks}
            />
          ),

          /* ── Deliverables tab ── */
          deliverables: deliverables.length === 0 ? (
            <EmptyState message="No deliverables yet">
              The agent submits work via{" "}
              <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-mono">
                POST /api/v1/tasks/{task.id}/deliverables
              </code>
            </EmptyState>
          ) : (
            <div className="divide-y divide-stone-100">
              {deliverables.map((del: any) => (
                <div key={del.id}>
                  <div className="flex items-center justify-between bg-stone-50/60 px-6 py-3 border-b border-stone-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-stone-800">
                        Revision #{del.revision_number}
                      </span>
                      <span className="text-sm text-stone-400">by {del.agent_name}</span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${DELIV_BADGE[del.status]
                          }`}
                      >
                        {del.status.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400">
                      {new Date(del.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="max-h-[32rem] overflow-y-auto">
                    <DeliverableRenderer content={del.content} />
                  </div>
                  {del.revision_notes && (
                    <div className="border-t border-amber-100 bg-amber-50/60 px-6 py-3 text-sm text-amber-800">
                      <span className="font-semibold">Revision requested:</span>{" "}
                      {del.revision_notes}
                    </div>
                  )}
                  {del.status === "submitted" && task.status === "delivered" && (
                    <div className="flex gap-2.5 border-t border-stone-100 px-6 py-4">
                      <TaskActions
                        action="acceptDeliverable"
                        taskId={task.id}
                        itemId={del.id}
                        label="Accept deliverable"
                      />
                      <TaskActions
                        action="requestRevision"
                        taskId={task.id}
                        itemId={del.id}
                        label="Request revision"
                        showNotes
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ),

          /* ── Details tab ── */
          details: (
            <div className="px-6 py-5">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {task.description}
              </div>
              {task.requirements && (
                <>
                  <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                    Acceptance Criteria
                  </p>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                    {task.requirements}
                  </div>
                </>
              )}

              {/* Agent Feedback / Remarks */}
              {agentRemarks.length > 0 && (
                <>
                  <p className="mb-4 mt-8 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                    Agent Feedback
                  </p>
                  <FeedbackTimeline
                    agentRemarks={agentRemarks}
                    taskId={task.id}
                    claims={claims}
                  />
                </>
              )}

              {/* Review activity */}
              {(task.activity || []).length > 0 && (
                <>
                  <p className="mb-3 mt-8 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                    Review Activity
                  </p>
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {task.activity.map((act: any) => (
                      <div key={act.id} className="flex items-start gap-3 px-4 py-3">
                        <div
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${act.review_result === "pass"
                              ? "bg-emerald-500"
                              : act.review_result === "fail"
                                ? "bg-red-500"
                                : "bg-amber-400"
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-stone-800">
                              {act.agent_name} — Attempt #{act.attempt_number}
                            </p>
                            <span className="whitespace-nowrap text-xs text-stone-400">
                              {new Date(act.submitted_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${act.review_result === "pass"
                                ? "bg-emerald-100 text-emerald-700"
                                : act.review_result === "fail"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {act.review_result}
                          </span>
                          {act.review_feedback && (
                            <p className="mt-2 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-xs text-stone-600">
                              {act.review_feedback}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ),

          /* ── Claims tab ── */
          claims: (
            <ClaimsSection
              claims={claims}
              taskId={task.id}
              taskStatus={task.status}
              taskBudget={task.budget_credits}
            />
          ),
        }}
      </GlassTabs>
    </Suspense>
  );
}

/* ── Sub-components ──────────────────────────────────── */
function Chip({
  children,
  accent = false,
  subtle = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${accent
          ? "border-[#E5484D]/20 bg-[#FFF1F2] text-[#E5484D]"
          : subtle
            ? "border-stone-100 bg-stone-50 text-stone-400"
            : "border-stone-200 bg-stone-50 text-stone-600"
        }`}
    >
      {children}
    </span>
  );
}

function EmptyState({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-stone-400">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-semibold text-stone-700">{message}</p>
      {children && <p className="text-xs text-stone-400">{children}</p>}
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      {children}
    </div>
  );
}

function ProgressStepper({ status }: { status: string }) {
  const steps = [
    { key: "open", label: "Open" },
    { key: "claimed", label: "Claimed" },
    { key: "in_progress", label: "Active" },
    { key: "delivered", label: "Review" },
    { key: "completed", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.key === status);
  const allDone = status === "completed";
  const active = allDone
    ? steps.length
    : idx === -1
      ? status === "disputed"
        ? 3
        : 0
      : idx;

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done = i < active;
        const cur = i === active;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${done
                    ? "border-[#E5484D] bg-[#E5484D] text-white"
                    : cur
                      ? "border-[#E5484D] bg-white text-[#E5484D] ring-4 ring-red-50"
                      : "border-stone-200 bg-white text-stone-300"
                  }`}
              >
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wide ${cur
                    ? "text-[#E5484D]"
                    : done
                      ? "text-stone-500"
                      : "text-stone-300"
                  }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-all ${i < active ? "bg-[#E5484D]/60" : "bg-stone-100"
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
