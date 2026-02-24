"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTaskStore, type TaskSummary } from "@/stores/task-store";

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  claimed: "bg-sky-500",
  in_progress: "bg-amber-500",
  delivered: "bg-violet-500",
  completed: "bg-stone-400",
  cancelled: "bg-red-500",
  disputed: "bg-orange-500",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  in_progress: "In Progress",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};
const STATUS_BADGE: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  claimed: "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-stone-100 text-stone-600 border-stone-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  disputed: "bg-orange-50 text-orange-700 border-orange-200",
};

export function RealtimeTaskList({
  initialTasks,
}: {
  initialTasks: TaskSummary[];
}) {
  const setTasks = useTaskStore((s) => s.setTasks);
  const tasks = useTaskStore((s) => s.taskList);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      setTasks(initialTasks);
      hydrated.current = true;
    }
  }, [initialTasks, setTasks]);

  const list = tasks ?? initialTasks;

  if (list.length === 0) {
    return null; // Parent handles empty state
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          Task
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          Status
        </span>
        <span className="text-right text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          Budget
        </span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-stone-100">
        {list.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const prevStatusRef = useRef(task.status);
  const rowRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (prevStatusRef.current !== task.status && rowRef.current) {
      rowRef.current.classList.add("animate-highlight");
      const timer = setTimeout(
        () => rowRef.current?.classList.remove("animate-highlight"),
        1500
      );
      prevStatusRef.current = task.status;
      return () => clearTimeout(timer);
    }
  }, [task.status]);

  const deadlineSoon =
    task.deadline &&
    new Date(task.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <Link
      ref={rowRef}
      href={`/dashboard/tasks/${task.id}`}
      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 transition-all hover:bg-stone-50/60"
    >
      {/* Title + meta */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-400">
          {task.category_name && <span>{task.category_name}</span>}
          <span>&middot;</span>
          <span>{new Date(task.created_at).toLocaleDateString()}</span>
          {task.deadline && (
            <>
              <span>&middot;</span>
              <span
                className={deadlineSoon ? "font-semibold text-[#E5484D]" : ""}
              >
                Due {new Date(task.deadline).toLocaleDateString()}
              </span>
            </>
          )}
          {(task.claims_count || 0) > 0 && (
            <>
              <span>&middot;</span>
              <span className="text-sky-600">
                {task.claims_count} claim
                {task.claims_count !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status] || "bg-stone-100 text-stone-600 border-stone-200"}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status] || "bg-stone-400"}`}
        />
        {STATUS_LABEL[task.status] || task.status}
      </span>

      {/* Budget */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-bold text-stone-900">
          {task.budget_credits}
        </span>
        <span className="ml-1 text-xs text-stone-400">cr</span>
      </div>

      {/* Arrow */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-stone-300"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
