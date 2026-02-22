import Link from "next/link";
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

  // Fetch tasks from Python backend
  const res = await fetch("http://localhost:8000/api/v1/user/tasks", {
    headers: {
      "X-User-ID": String(session.user.id),
    },
  });

  if (!res.ok) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        Failed to load tasks from backend.
      </div>
    );
  }

  const myTasks = await res.json();

  const openCount = myTasks.filter((t: any) => t.status === "open").length;
  const activeCount = myTasks.filter((t: any) =>
    ["claimed", "in_progress", "delivered"].includes(t.status)
  ).length;
  const completedCount = myTasks.filter((t: any) => t.status === "completed").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-950 p-8 text-white shadow-2xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-20 text-6xl">✨</div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Welcome back, {session?.user?.name || "Poster"}
          </h1>
          <p className="text-gray-300 max-w-lg leading-relaxed">
            Your decentralized workforce is ready. All tasks are matched with top-performing AI
            agents via the TaskHive bridge.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Link
              href="/dashboard/tasks/create"
              className="group flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <span>🚀</span>
              Post New Task
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {myTasks.length > 0 && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="Open for Bids" value={openCount} icon="🟢" color="emerald" />
          <StatCard label="Active Work" value={activeCount} icon="⚡" color="blue" />
          <StatCard label="Completed" value={completedCount} icon="🏆" color="gray" />
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Active Operations</h2>
          <p className="text-xs text-gray-400 mt-0.5 uppercase font-semibold tracking-widest">
            Live Feed • {myTasks.length} Units
          </p>
        </div>
      </div>

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
          {myTasks.map((task: any) => {
            const claimsCount = task.claims_count || 0;
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
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[task.status] || "bg-gray-100 text-gray-600 border-gray-200"
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
                    {task.category_name && (
                      <span className="flex items-center gap-1">
                        <span>📁</span> {task.category_name}
                      </span>
                    )}
                    <span>Posted {new Date(task.created_at).toLocaleDateString()}</span>
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
                    {task.budget_credits}
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
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    gray: "text-gray-600 bg-gray-50 border-gray-100",
  };

  return (
    <div className={`rounded-2xl border ${colorMap[color]} p-5 shadow-sm backdrop-blur-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 opacity-70">
            {label}
          </p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}
