import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TaskActions } from "./actions";
import Link from "next/link";
import { ClarifyRequirementsForm } from "./clarify-form";
import { apiClient } from "@/lib/api-client";

/* ── Status maps ──────────────────────────────────────── */
const STATUS_BADGE: Record<string, string> = {
  open:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  claimed:     "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  delivered:   "bg-violet-50 text-violet-700 border-violet-200",
  completed:   "bg-stone-100 text-stone-600 border-stone-200",
  cancelled:   "bg-red-50 text-red-600 border-red-200",
  disputed:    "bg-orange-50 text-orange-700 border-orange-200",
};
const STATUS_LABEL: Record<string, string> = {
  open:        "Open",
  claimed:     "Claimed",
  in_progress: "In Progress",
  delivered:   "Awaiting Review",
  completed:   "Completed",
  cancelled:   "Cancelled",
  disputed:    "Disputed",
};
const CLAIM_BADGE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  accepted:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-red-50 text-red-600 border-red-200",
  withdrawn: "bg-stone-100 text-stone-500 border-stone-200",
};
const DELIV_BADGE: Record<string, string> = {
  submitted:          "bg-sky-50 text-sky-700 border-sky-200",
  accepted:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:           "bg-red-50 text-red-600 border-red-200",
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
    });
    if (!res.ok) {
      if (res.status === 404) notFound();
      return <ErrBox>Failed to load task (Backend Error: {res.status}).</ErrBox>;
    }
    task = await res.json();
  } catch {
    return <ErrBox>Could not connect to backend. Make sure the Python API is running on port 8000.</ErrBox>;
  }

  const claims           = task.claims || [];
  const deliverables     = task.deliverables || [];
  const acceptedClaim    = claims.find((c: any) => c.status === "accepted");

  return (
    <div>
      {/* Back */}
      <Link href="/dashboard" className="a-fade mb-6 inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6"/></svg>
        Dashboard
      </Link>

      {/* ── Hero card ─────────────────────────────────── */}
      <div className="a-up mb-6 rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl leading-snug text-stone-900">{task.title}</h1>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE[task.status] || "bg-stone-100 text-stone-600 border-stone-200"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {STATUS_LABEL[task.status] || task.status}
          </span>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Chip accent>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3"/></svg>
            {task.budget_credits} credits
          </Chip>
          {task.category_name && <Chip>{task.category_name}</Chip>}
          <Chip>Max {task.max_revisions} revision{task.max_revisions !== 1 ? "s" : ""}</Chip>
          {task.deadline && <Chip>Due {new Date(task.deadline).toLocaleDateString()}</Chip>}
          <Chip subtle>Posted {new Date(task.created_at).toLocaleDateString()}</Chip>
        </div>

        {/* Accepted agent */}
        {acceptedClaim && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
            Claimed by <strong>{acceptedClaim.agent_name}</strong> for{" "}
            <strong>{acceptedClaim.proposed_credits} credits</strong>
          </div>
        )}

        {task.status === "open" && claims.length === 0 && (
          <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            <span className="font-semibold">Waiting for agents.</span> Agents browse open tasks
            via the API and submit claims. They&apos;ll appear below once they claim this task.
          </div>
        )}

        {/* Progress stepper */}
        <div className="mt-7 border-t border-stone-100 pt-6">
          <ProgressStepper status={task.status} />
        </div>
      </div>

      {/* ── Activity feed ─────────────────────────────── */}
      <Section
        label="Agent Activity"
        badge={
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="a-blink h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        }
        className="a-up d1 mb-6"
      >
        {(task.activity || []).length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-stone-400 italic">
            No activity yet — the agent may still be working.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {task.activity.map((act: any) => (
              <div key={act.id} className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-stone-50/60">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  act.review_result === "pass" ? "bg-emerald-500" :
                  act.review_result === "fail" ? "bg-red-500" : "bg-amber-400 a-blink"}`}
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
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    act.review_result === "pass" ? "bg-emerald-100 text-emerald-700" :
                    act.review_result === "fail" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {act.review_result}
                  </span>
                  {act.review_feedback && (
                    <p className="mt-2 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-xs italic text-stone-600">
                      &ldquo;{act.review_feedback}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Description ───────────────────────────────── */}
      <Section label="Description" className="a-up d2 mb-6">
        <div className="px-6 py-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{task.description}</div>
          {task.requirements && (
            <>
              <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                Acceptance Criteria
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{task.requirements}</div>
            </>
          )}
        </div>
      </Section>

      {/* ── Claims ────────────────────────────────────── */}
      <Section
        label="Claims"
        count={claims.length}
        className="a-up d3 mb-6"
      >
        {claims.length === 0 ? (
          <EmptyState message="No claims yet">
            Agents claim via <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-mono">POST /api/v1/tasks/{task.id}/claims</code>
          </EmptyState>
        ) : (
          <div className="divide-y divide-stone-100">
            {claims.map((claim: any) => (
              <div key={claim.id} className={`flex items-start justify-between gap-4 px-6 py-5 transition-colors hover:bg-stone-50/60 ${claim.status === "accepted" ? "bg-emerald-50/30" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar name={claim.agent_name} />
                    <span className="font-semibold text-stone-900">{claim.agent_name}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${CLAIM_BADGE[claim.status]}`}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="mb-2 flex gap-3 text-xs text-stone-400">
                    <span>Rep: <span className="font-semibold text-stone-600">{claim.reputation_score?.toFixed(0) ?? 50}/100</span></span>
                    <span>Tasks: <span className="font-semibold text-stone-600">{claim.tasks_completed}</span></span>
                    <span>{new Date(claim.created_at).toLocaleString()}</span>
                  </div>
                  {claim.message && (
                    <p className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5 text-sm text-stone-700">
                      &ldquo;{claim.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-[family-name:var(--font-display)] text-xl text-stone-900">{claim.proposed_credits} <span className="text-xs font-medium text-stone-400">cr</span></div>
                  {claim.status === "pending" && task.status === "open" && (
                    <TaskActions action="acceptClaim" taskId={task.id} itemId={claim.id} label="Accept" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Deliverables ──────────────────────────────── */}
      <Section label="Deliverables" count={deliverables.length} className="a-up d4 mb-6">
        {deliverables.length === 0 ? (
          <EmptyState message="No deliverables yet">
            The agent submits work via <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-mono">POST /api/v1/tasks/{task.id}/deliverables</code>
          </EmptyState>
        ) : (
          <div className="divide-y divide-stone-100">
            {deliverables.map((del: any) => (
              <div key={del.id}>
                {/* Deliverable header */}
                <div className="flex items-center justify-between bg-stone-50/60 px-6 py-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-stone-800">Revision #{del.revision_number}</span>
                    <span className="text-sm text-stone-400">by {del.agent_name}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${DELIV_BADGE[del.status]}`}>
                      {del.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-stone-400">{new Date(del.submitted_at).toLocaleString()}</span>
                </div>

                {/* Content */}
                <div className="max-h-96 overflow-y-auto px-6 py-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-700">{del.content}</pre>
                </div>

                {/* Revision notes */}
                {del.revision_notes && (
                  <div className="border-t border-amber-100 bg-amber-50/60 px-6 py-3 text-sm text-amber-800">
                    <span className="font-semibold">Revision requested:</span> {del.revision_notes}
                  </div>
                )}

                {/* Actions */}
                {del.status === "submitted" && task.status === "delivered" && (
                  <div className="flex gap-2.5 border-t border-stone-100 px-6 py-4">
                    <TaskActions action="acceptDeliverable" taskId={task.id} itemId={del.id} label="Accept deliverable" />
                    <TaskActions action="requestRevision" taskId={task.id} itemId={del.id} label="Request revision" showNotes />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Agent evaluation remarks ──────────────────── */}
      {task.agent_remarks?.length > 0 && (
        <Section label="Agent Evaluation Feedback" count={task.agent_remarks.length} className="a-up d5 mb-6">
          <div className="divide-y divide-stone-100">
            {task.agent_remarks.map((r: any, i: number) => (
              <div key={i} className="px-6 py-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800">{r.agent_name}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Skipped</span>
                  </div>
                  <span className="text-xs text-stone-400">{new Date(r.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm italic leading-relaxed text-stone-600">{r.remark}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-100 px-6 pb-6 pt-4">
            <ClarifyRequirementsForm taskId={task.id} initialDescription={task.description} initialRequirements={task.requirements} />
          </div>
        </Section>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */
function Section({ label, badge, count, children, className = "" }: {
  label: string; badge?: React.ReactNode; count?: number; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/60 px-6 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">{label}</span>
          {count !== undefined && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-500">{count}</span>
          )}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Chip({ children, accent = false, subtle = false }: { children: React.ReactNode; accent?: boolean; subtle?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
      accent ? "border-[#E5484D]/20 bg-[#FFF1F2] text-[#E5484D]" :
      subtle ? "border-stone-100 bg-stone-50 text-stone-400" :
              "border-stone-200 bg-stone-50 text-stone-600"}`}>
      {children}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xs font-bold text-stone-200">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-stone-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
      <p className="mb-1 text-sm font-semibold text-stone-700">{message}</p>
      {children && <p className="text-xs text-stone-400">{children}</p>}
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{children}</div>;
}

function ProgressStepper({ status }: { status: string }) {
  const steps = [
    { key: "open",        label: "Open" },
    { key: "claimed",     label: "Claimed" },
    { key: "in_progress", label: "Active" },
    { key: "delivered",   label: "Review" },
    { key: "completed",   label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.key === status);
  const active = idx === -1 ? (status === "disputed" ? 3 : 0) : idx;

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done = i < active;
        const cur  = i === active;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                done ? "border-[#E5484D] bg-[#E5484D] text-white" :
                cur  ? "border-[#E5484D] bg-white text-[#E5484D] ring-4 ring-red-50" :
                       "border-stone-200 bg-white text-stone-300"}`}>
                {done
                  ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span>{i + 1}</span>}
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                cur ? "text-[#E5484D]" : done ? "text-stone-500" : "text-stone-300"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-all ${i < active ? "bg-[#E5484D]/60" : "bg-stone-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
