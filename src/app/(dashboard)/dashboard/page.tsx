import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { RealtimeTaskList } from "@/components/realtime-task-list";
import { TaskHydrator } from "@/stores/hydration-provider";

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

      {/* ── Hydrate client store ──────────────────────── */}
      <TaskHydrator tasks={myTasks} />

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
        <div className="a-up d3">
          <RealtimeTaskList initialTasks={myTasks} />
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
