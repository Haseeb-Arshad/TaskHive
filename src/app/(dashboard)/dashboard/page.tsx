import Link from "next/link";
import { db } from "@/lib/db/client";
import { tasks, categories, taskClaims } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  claimed: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  delivered: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <Link
          href="/dashboard/tasks/create"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Create Task
        </Link>
      </div>

      {myTasks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="mb-4 text-gray-500">You haven&apos;t posted any tasks yet.</p>
          <Link
            href="/dashboard/tasks/create"
            className="text-sm font-medium text-gray-900 underline"
          >
            Create your first task
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myTasks.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/tasks/${task.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-900">
                      {task.title}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[task.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {task.categoryName && <span>{task.categoryName}</span>}
                    <span>{claimsCounts[task.id] || 0} claims</span>
                    <span>
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                    {task.deadline && (
                      <span>
                        Due: {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {task.budgetCredits}
                  </div>
                  <div className="text-xs text-gray-500">credits</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
