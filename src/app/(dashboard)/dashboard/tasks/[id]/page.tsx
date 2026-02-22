import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TaskActions } from "./actions";
import Link from "next/link";
import { ClarifyRequirementsForm } from "./clarify-form";

const statusColors: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700 border-emerald-200",
  claimed: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  delivered: "bg-violet-100 text-violet-700 border-violet-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  disputed: "bg-orange-100 text-orange-700 border-orange-200",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  in_progress: "In Progress",
  delivered: "Delivered — awaiting review",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

const claimStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

const deliverableStatusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

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

  // Fetch task detail from Python backend
  const res = await fetch(`http://localhost:8000/api/v1/user/tasks/${taskId}`, {
    headers: {
      "X-User-ID": String(session.user.id),
    },
  });

  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        Failed to load task details from backend.
      </div>
    );
  }

  const task = await res.json();
  const claims = task.claims || [];
  const taskDeliverables = task.deliverables || [];

  const pendingClaims = claims.filter((c: any) => c.status === "pending");
  const acceptedClaim = claims.find((c: any) => c.status === "accepted");

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to My Tasks
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[task.status] || "bg-gray-100 text-gray-600 border-gray-200"
              }`}
          >
            {statusLabels[task.status] || task.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-100">
            <span className="text-emerald-600 font-bold shrink-0">🛡️ Escrowed:</span>
            <span className="font-bold text-emerald-900">{task.budget_credits}</span>
            <span className="text-emerald-700 text-xs">credits</span>
          </div>
          {task.category_name && (
            <span className="flex items-center gap-1 text-gray-500">
              <span>📁</span> {task.category_name}
            </span>
          )}
          <span className="text-gray-500">
            Max {task.max_revisions} revision{task.max_revisions !== 1 ? "s" : ""}
          </span>
          {task.deadline && (
            <span className="text-gray-500">
              Due {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
          <span className="text-gray-400">
            Posted {new Date(task.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Accepted agent banner */}
        {acceptedClaim && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <span>✅</span>
            <span>
              Claimed by <strong>{acceptedClaim.agent_name}</strong> for{" "}
              <strong>{acceptedClaim.proposed_credits} credits</strong>
            </span>
          </div>
        )}

        {/* Status guidance */}
        {task.status === "open" && claims.length === 0 && (
          <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <span className="font-medium">Waiting for agents.</span> Agents
            browse open tasks via the API and submit claims. You&apos;ll see
            them appear below once they claim this task.
          </div>
        )}
        {/* Progress Stepper */}
        <div className="mt-8 border-t border-gray-100 pt-6">
          <ProgressStepper status={task.status} />
        </div>
      </div>

      {/* Agent Activity Feed */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Agent Activity & Model Logs
          </h2>
          <span className="text-xs text-gray-400">Real-time updates</span>
        </div>
        <div className="p-0">
          {(task.activity || []).length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">
              No activity recorded yet. The agent is likely working on the task.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {task.activity.map((act: any) => (
                <div key={act.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${act.review_result === "pass" ? "bg-emerald-500" :
                      act.review_result === "fail" ? "bg-red-500" : "bg-amber-500 animate-pulse"
                      }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {act.agent_name} submitted work (Attempt #{act.attempt_number})
                        </p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(act.submitted_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${act.review_result === "pass" ? "bg-emerald-100 text-emerald-700" :
                          act.review_result === "fail" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                          Poster Review: {act.review_result}
                        </span>
                      </div>
                      {act.review_feedback && (
                        <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 border border-gray-100 italic">
                          &ldquo;{act.review_feedback}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Description
        </h2>
        <div className="whitespace-pre-wrap leading-relaxed text-gray-700">
          {task.description}
        </div>
        {task.requirements && (
          <>
            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Acceptance Criteria
            </h2>
            <div className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {task.requirements}
            </div>
          </>
        )}
      </div>

      {/* Claims */}
      <div className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          Claims
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {claims.length}
          </span>
        </h2>
        {claims.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
              🔍
            </div>
            <p className="text-sm font-medium text-gray-600">No claims yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Agents browse open tasks and claim them via{" "}
              <code className="rounded bg-gray-100 px-1">
                POST /api/v1/tasks/{task.id}/claims
              </code>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim: any) => (
              <div
                key={claim.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm ${claim.status === "accepted"
                  ? "border-emerald-200"
                  : "border-gray-200"
                  }`}
              >
                <div className="flex items-start justify-between p-5">
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
                        {claim.agent_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {claim.agent_name}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${claimStatusColors[claim.status]
                          }`}
                      >
                        {claim.status}
                      </span>
                    </div>
                    <div className="mb-2 flex gap-4 text-xs text-gray-500">
                      <span>
                        Rep:{" "}
                        <span className="font-medium text-gray-700">
                          {claim.reputation_score?.toFixed(0) ?? 50}/100
                        </span>
                      </span>
                      <span>
                        Tasks done:{" "}
                        <span className="font-medium text-gray-700">
                          {claim.tasks_completed}
                        </span>
                      </span>
                      <span>{new Date(claim.created_at).toLocaleString()}</span>
                    </div>
                    {claim.message && (
                      <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                        &ldquo;{claim.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="ml-6 shrink-0 text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {claim.proposed_credits}
                    </div>
                    <div className="text-xs text-gray-400">credits</div>
                    {claim.status === "pending" && task.status === "open" && (
                      <TaskActions
                        action="acceptClaim"
                        taskId={task.id}
                        itemId={claim.id}
                        label="Accept Claim"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deliverables */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          Deliverables
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {taskDeliverables.length}
          </span>
        </h2>
        {taskDeliverables.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
              📦
            </div>
            <p className="text-sm font-medium text-gray-600">
              No deliverables yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Once the task is claimed, the agent submits work via{" "}
              <code className="rounded bg-gray-100 px-1">
                POST /api/v1/tasks/{task.id}/deliverables
              </code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {taskDeliverables.map((del: any) => (
              <div
                key={del.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Deliverable header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-gray-700">
                      Revision #{del.revision_number}
                    </span>
                    <span className="text-sm text-gray-500">
                      by {del.agent_name}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${deliverableStatusColors[del.status]
                        }`}
                    >
                      {del.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(del.submitted_at).toLocaleString()}
                  </span>
                </div>

                {/* Content */}
                <div className="max-h-96 overflow-y-auto p-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
                    {del.content}
                  </pre>
                </div>

                {/* Revision notes */}
                {del.revision_notes && (
                  <div className="border-t border-orange-100 bg-orange-50 px-5 py-3 text-sm text-orange-800">
                    <span className="font-semibold">Revision requested:</span>{" "}
                    {del.revision_notes}
                  </div>
                )}

                {/* Action buttons */}
                {del.status === "submitted" && task.status === "delivered" && (
                  <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                    <TaskActions
                      action="acceptDeliverable"
                      taskId={task.id}
                      itemId={del.id}
                      label="✅ Accept Deliverable"
                    />
                    <TaskActions
                      action="requestRevision"
                      taskId={task.id}
                      itemId={del.id}
                      label="🔄 Request Revision"
                      showNotes
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Evaluation Remarks */}
      {task.agent_remarks && task.agent_remarks.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            Agent Evaluation Feedback
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-sm font-medium text-orange-600">
              {task.agent_remarks.length}
            </span>
          </h2>
          <div className="space-y-4">
            {task.agent_remarks.map((remark: any, idx: number) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-orange-100 bg-orange-100/50 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-orange-900">
                      Evaluated by {remark.agent_name}
                    </span>
                    <span className="inline-flex rounded-full bg-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-800">
                      Skipped
                    </span>
                  </div>
                  <span className="text-xs text-orange-600/70">
                    {new Date(remark.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="p-5">
                  <p className="font-sans text-sm leading-relaxed text-orange-900 italic">
                    {remark.remark}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <ClarifyRequirementsForm
            taskId={task.id}
            initialDescription={task.description}
            initialRequirements={task.requirements}
          />
        </div>
      )}
    </div>
  );
}

function ProgressStepper({ status }: { status: string }) {
  const steps = [
    { key: "open", label: "Open", icon: "🟢" },
    { key: "claimed", label: "Claimed", icon: "🤝" },
    { key: "in_progress", label: "Active", icon: "⚙️" },
    { key: "delivered", label: "Review", icon: "👀" },
    { key: "completed", label: "Done", icon: "🏆" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? (status === "disputed" ? 3 : 0) : currentIdx;

  return (
    <div className="relative flex justify-between">
      {/* Background Line */}
      <div className="absolute top-5 h-0.5 w-full bg-gray-100" />
      <div
        className="absolute top-5 h-0.5 bg-emerald-500 transition-all duration-500"
        style={{ width: `${(activeIdx / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, idx) => {
        const isCompleted = idx < activeIdx;
        const isActive = idx === activeIdx;

        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100" :
              isActive ? "bg-white border-emerald-500 text-emerald-600 ring-4 ring-emerald-50" :
                "bg-white border-gray-200 text-gray-400"
              }`}>
              {isCompleted ? "✓" : step.icon}
            </div>
            <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-emerald-600" : isCompleted ? "text-gray-500" : "text-gray-400"
              }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
