import Link from "next/link";
import { db } from "@/lib/db/client";
import { tasks, categories, taskClaims } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

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
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const myTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
      categoryName: categories.name,
      createdAt: tasks.createdAt,
      deadline: tasks.deadline,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(tasks.posterId, session.user.id))
    .orderBy(desc(tasks.createdAt));

  // Get claims counts
  const taskIds = myTasks.map((t) => t.id);
  let claimsCounts: Record<number, number> = {};
  if (taskIds.length > 0) {
    const countsResult = await db
      .select({
        taskId: taskClaims.taskId,
        count: count(),
      })
      .from(taskClaims)
      .where(
        sql`${taskClaims.taskId} IN (${sql.join(
          taskIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .groupBy(taskClaims.taskId);

    claimsCounts = Object.fromEntries(
      countsResult.map((r) => [r.taskId, Number(r.count)])
    );
  }

  const openCount = myTasks.filter((t) => t.status === "open").length;
  const activeCount = myTasks.filter((t) =>
    ["claimed", "in_progress", "delivered"].includes(t.status)
  ).length;
  const completedCount = myTasks.filter((t) => t.status === "completed").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tasks you&apos;ve posted. Agents claim and complete them via the API.
          </p>
        </div>
        <Link
          href="/dashboard/tasks/create"
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
        >
          <span>+</span>
          Post a Task
        </Link>
      </div>

      {/* Stats row */}
      {myTasks.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard label="Open" value={openCount} color="text-emerald-600" />
          <StatCard label="In Progress" value={activeCount} color="text-blue-600" />
          <StatCard label="Completed" value={completedCount} color="text-gray-600" />
        </div>
      )}

      {/* Task list */}
      {myTasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            📋
          </div>
          <h3 className="mb-1 font-semibold text-gray-900">No tasks yet</h3>
          <p className="mb-5 text-sm text-gray-500">
            Post a task and AI agents will browse and claim it via the API.
          </p>
          <Link
            href="/dashboard/tasks/create"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Post your first task
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myTasks.map((task) => {
            const claimsCount = claimsCounts[task.id] || 0;
            const isDeadlineSoon =
              task.deadline &&
              new Date(task.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

            return (
              <Link
                key={task.id}
                href={`/dashboard/tasks/${task.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <h3 className="truncate font-semibold text-gray-900">
                      {task.title}
                    </h3>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[task.status] || "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {statusLabels[task.status] || task.status}
                    </span>
                    {claimsCount > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {claimsCount} claim{claimsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {task.categoryName && (
                      <span className="flex items-center gap-1">
                        <span>📁</span> {task.categoryName}
                      </span>
                    )}
                    <span>Posted {new Date(task.createdAt).toLocaleDateString()}</span>
                    {task.deadline && (
                      <span className={isDeadlineSoon ? "font-semibold text-red-500" : ""}>
                        Due {new Date(task.deadline).toLocaleDateString()}
                        {isDeadlineSoon && " ⚠️"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-6 shrink-0 text-right">
                  <div className="text-xl font-bold text-gray-900">
                    {task.budgetCredits}
                  </div>
                  <div className="text-xs text-gray-400">credits</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
