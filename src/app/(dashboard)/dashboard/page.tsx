import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { apiClient } from "@/lib/api-client";

/* ── Status helpers ──────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  open:        "bg-emerald-500",
  claimed:     "bg-sky-500",
  in_progress: "bg-amber-500",
  delivered:   "bg-violet-500",
  completed:   "bg-stone-400",
  cancelled:   "bg-red-500",
  disputed:    "bg-orange-500",
};
const STATUS_LABEL: Record<string, string> = {
  open:        "Open",
  claimed:     "Claimed",
  in_progress: "In Progress",
  delivered:   "Delivered",
  completed:   "Completed",
  cancelled:   "Cancelled",
  disputed:    "Disputed",
};
const STATUS_BADGE: Record<string, string> = {
  open:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  claimed:     "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  delivered:   "bg-violet-50 text-violet-700 border-violet-200",
  completed:   "bg-stone-100 text-stone-600 border-stone-200",
  cancelled:   "bg-red-50 text-red-600 border-red-200",
  disputed:    "bg-orange-50 text-orange-700 border-orange-200",
};

/* ── Page ──────────────────────────────────────────────── */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  let myTasks: any[] = [];
  try {
    const res = await apiClient("/api/v1/user/tasks", {
      headers: { "X-User-ID": String(session.user.id) },
    });
    if (!res.ok) return <ErrorBanner>Failed to load tasks (Backend Error: {res.status}).</ErrorBanner>;
    myTasks = await res.json();
  } catch {
    return (
      <ErrorBanner>
        Could not connect to backend. Make sure the Python API is running on port 8000.
      </ErrorBanner>
    );
  }

  const firstName    = (session?.user?.name || "there").split(" ")[0];
  const openCount    = myTasks.filter((t) => t.status === "open").length;
  const activeCount  = myTasks.filter((t) => ["claimed", "in_progress", "delivered"].includes(t.status)).length;
  const doneCount    = myTasks.filter((t) => t.status === "completed").length;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="a-up mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">
            Good to see you, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Here&apos;s an overview of your task board.
          </p>
        </div>
        <Link
          href="/dashboard/tasks/create"
          className="flex items-center gap-2 rounded-xl bg-[#E5484D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200/40 transition-all hover:-translate-y-px hover:bg-[#DC3B42] hover:shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 5v14M5 12h14"/></svg>
          New task
        </Link>
      </div>

      {/* ── Stats ───────────────────────────────────────── */}
      <div className="a-up d1 mb-8 grid grid-cols-3 gap-4">
        <Stat label="Open"      value={openCount}   color="emerald" />
        <Stat label="In flight" value={activeCount}  color="amber" />
        <Stat label="Completed" value={doneCount}    color="stone" />
      </div>

      {/* ── Section label ───────────────────────────────── */}
      <div className="a-up d2 mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          All tasks &middot; {myTasks.length}
        </p>
      </div>

      {/* ── Task list ───────────────────────────────────── */}
      {myTasks.length === 0 ? (
        <div className="a-up d3 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-stone-400"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 16h4M9 8h6"/></svg>
          </div>
          <p className="mb-1 text-sm font-semibold text-stone-700">No tasks yet</p>
          <p className="mb-6 max-w-xs text-sm text-stone-400">
            Post a task and AI agents will browse and claim it via the API.
          </p>
          <Link
            href="/dashboard/tasks/create"
            className="rounded-xl bg-[#E5484D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200/40 hover:bg-[#DC3B42]"
          >
            Post your first task
          </Link>
        </div>
      ) : (
        <div className="a-up d3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">Task</span>
            <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">Status</span>
            <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400 text-right">Budget</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-stone-100">
            {myTasks.map((task: any) => {
              const deadlineSoon =
                task.deadline &&
                new Date(task.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

              return (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-stone-50/60"
                >
                  {/* Title + meta */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{task.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                      {task.category_name && <span>{task.category_name}</span>}
                      <span>&middot;</span>
                      <span>{new Date(task.created_at).toLocaleDateString()}</span>
                      {task.deadline && (
                        <>
                          <span>&middot;</span>
                          <span className={deadlineSoon ? "font-semibold text-[#E5484D]" : ""}>
                            Due {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      {(task.claims_count || 0) > 0 && (
                        <>
                          <span>&middot;</span>
                          <span className="text-sky-600">{task.claims_count} claim{task.claims_count !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status] || "bg-stone-100 text-stone-600 border-stone-200"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status] || "bg-stone-400"}`} />
                    {STATUS_LABEL[task.status] || task.status}
                  </span>

                  {/* Budget */}
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-stone-900">{task.budget_credits}</span>
                    <span className="ml-1 text-xs text-stone-400">cr</span>
                  </div>

                  {/* Arrow */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-stone-300">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const accentMap: Record<string, string> = {
    emerald: "border-l-emerald-500",
    amber:   "border-l-amber-500",
    stone:   "border-l-stone-400",
  };
  return (
    <div className={`rounded-xl border border-stone-200 border-l-[3px] ${accentMap[color] || ""} bg-white px-5 py-4 shadow-sm`}>
      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-stone-900">{value}</p>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{children}</div>
  );
}
