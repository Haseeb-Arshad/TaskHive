import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import {
  tasks,
  taskClaims,
  deliverables,
  agents,
  categories,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { TaskActions } from "./actions";
import Link from "next/link";

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

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      requirements: tasks.requirements,
      budgetCredits: tasks.budgetCredits,
      status: tasks.status,
      posterId: tasks.posterId,
      claimedByAgentId: tasks.claimedByAgentId,
      maxRevisions: tasks.maxRevisions,
      deadline: tasks.deadline,
      createdAt: tasks.createdAt,
      categoryName: categories.name,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task || task.posterId !== session.user.id) notFound();

  // Get claims with agent info
  const claims = await db
    .select({
      id: taskClaims.id,
      agentId: taskClaims.agentId,
      agentName: agents.name,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
      reputationScore: agents.reputationScore,
      tasksCompleted: agents.tasksCompleted,
    })
    .from(taskClaims)
    .innerJoin(agents, eq(taskClaims.agentId, agents.id))
    .where(eq(taskClaims.taskId, taskId))
    .orderBy(desc(taskClaims.createdAt));

  // Get deliverables
  const taskDeliverables = await db
    .select({
      id: deliverables.id,
      agentId: deliverables.agentId,
      agentName: agents.name,
      content: deliverables.content,
      status: deliverables.status,
      revisionNumber: deliverables.revisionNumber,
      revisionNotes: deliverables.revisionNotes,
      submittedAt: deliverables.submittedAt,
    })
    .from(deliverables)
    .innerJoin(agents, eq(deliverables.agentId, agents.id))
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt));

  const pendingClaims = claims.filter((c) => c.status === "pending");
  const acceptedClaim = claims.find((c) => c.status === "accepted");

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
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${
              statusColors[task.status] || "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {statusLabels[task.status] || task.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5">
            <span className="text-amber-600">💰</span>
            <span className="font-bold text-amber-900">{task.budgetCredits}</span>
            <span className="text-amber-700">credits</span>
          </div>
          {task.categoryName && (
            <span className="flex items-center gap-1 text-gray-500">
              <span>📁</span> {task.categoryName}
            </span>
          )}
          <span className="text-gray-500">
            Max {task.maxRevisions} revision{task.maxRevisions !== 1 ? "s" : ""}
          </span>
          {task.deadline && (
            <span className="text-gray-500">
              Due {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
          <span className="text-gray-400">
            Posted {new Date(task.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Accepted agent banner */}
        {acceptedClaim && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <span>✅</span>
            <span>
              Claimed by <strong>{acceptedClaim.agentName}</strong> for{" "}
              <strong>{acceptedClaim.proposedCredits} credits</strong>
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
        {task.status === "open" && pendingClaims.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">
              {pendingClaims.length} pending claim
              {pendingClaims.length !== 1 ? "s" : ""}.
            </span>{" "}
            Review them below and accept the one you want. All others will be
            automatically rejected.
          </div>
        )}
        {task.status === "delivered" && (
          <div className="mt-4 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-800">
            <span className="font-medium">Work submitted!</span> Review the
            deliverable below and accept it or request changes.
          </div>
        )}
        {task.status === "completed" && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="font-medium">Task completed!</span> Credits have
            been awarded to the agent operator.
          </div>
        )}
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
            {claims.map((claim) => (
              <div
                key={claim.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                  claim.status === "accepted"
                    ? "border-emerald-200"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between p-5">
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
                        {claim.agentName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {claim.agentName}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          claimStatusColors[claim.status]
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>
                    <div className="mb-2 flex gap-4 text-xs text-gray-500">
                      <span>
                        Rep:{" "}
                        <span className="font-medium text-gray-700">
                          {claim.reputationScore?.toFixed(0) ?? 50}/100
                        </span>
                      </span>
                      <span>
                        Tasks done:{" "}
                        <span className="font-medium text-gray-700">
                          {claim.tasksCompleted}
                        </span>
                      </span>
                      <span>{new Date(claim.createdAt).toLocaleString()}</span>
                    </div>
                    {claim.message && (
                      <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                        &ldquo;{claim.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="ml-6 shrink-0 text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {claim.proposedCredits}
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
            {taskDeliverables.map((del) => (
              <div
                key={del.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Deliverable header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-gray-700">
                      Revision #{del.revisionNumber}
                    </span>
                    <span className="text-sm text-gray-500">
                      by {del.agentName}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        deliverableStatusColors[del.status]
                      }`}
                    >
                      {del.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(del.submittedAt).toLocaleString()}
                  </span>
                </div>

                {/* Content */}
                <div className="max-h-96 overflow-y-auto p-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
                    {del.content}
                  </pre>
                </div>

                {/* Revision notes */}
                {del.revisionNotes && (
                  <div className="border-t border-orange-100 bg-orange-50 px-5 py-3 text-sm text-orange-800">
                    <span className="font-semibold">Revision requested:</span>{" "}
                    {del.revisionNotes}
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
    </div>
  );
}
