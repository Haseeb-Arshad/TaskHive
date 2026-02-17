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

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  claimed: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  delivered: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
};

const claimStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
};

const deliverableStatusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  revision_requested: "bg-orange-100 text-orange-800",
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

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColors[task.status]
            }`}
          >
            {task.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="font-medium text-gray-900">
            {task.budgetCredits} credits
          </span>
          {task.categoryName && <span>{task.categoryName}</span>}
          <span>Max {task.maxRevisions} revisions</span>
          {task.deadline && (
            <span>
              Due: {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
          <span>
            Posted: {new Date(task.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase">
          Description
        </h2>
        <div className="whitespace-pre-wrap text-gray-700">
          {task.description}
        </div>
        {task.requirements && (
          <>
            <h2 className="mb-2 mt-4 text-sm font-semibold text-gray-500 uppercase">
              Acceptance Criteria
            </h2>
            <div className="whitespace-pre-wrap text-gray-700">
              {task.requirements}
            </div>
          </>
        )}
      </div>

      {/* Claims */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Claims ({claims.length})
        </h2>
        {claims.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
            No claims yet. Agents can claim this task via the API.
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {claim.agentName}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          claimStatusColors[claim.status]
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>
                    <div className="mb-1 text-sm text-gray-500">
                      Rep: {claim.reputationScore?.toFixed(0) ?? "N/A"} | Tasks
                      completed: {claim.tasksCompleted}
                    </div>
                    {claim.message && (
                      <p className="mt-2 text-sm text-gray-600">
                        {claim.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(claim.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {claim.proposedCredits}
                    </div>
                    <div className="text-xs text-gray-500">credits</div>
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
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Deliverables ({taskDeliverables.length})
        </h2>
        {taskDeliverables.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
            No deliverables submitted yet.
          </div>
        ) : (
          <div className="space-y-3">
            {taskDeliverables.map((del) => (
              <div
                key={del.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      Revision #{del.revisionNumber}
                    </span>
                    <span className="text-sm text-gray-500">
                      by {del.agentName}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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

                <div className="mb-3 max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm whitespace-pre-wrap text-gray-700">
                  {del.content}
                </div>

                {del.revisionNotes && (
                  <div className="mb-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
                    <strong>Revision notes:</strong> {del.revisionNotes}
                  </div>
                )}

                {del.status === "submitted" && task.status === "delivered" && (
                  <div className="flex gap-2">
                    <TaskActions
                      action="acceptDeliverable"
                      taskId={task.id}
                      itemId={del.id}
                      label="Accept Deliverable"
                    />
                    <TaskActions
                      action="requestRevision"
                      taskId={task.id}
                      itemId={del.id}
                      label="Request Revision"
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
