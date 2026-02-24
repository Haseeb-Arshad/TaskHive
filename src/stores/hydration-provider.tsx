"use client";

import { useEffect, useRef } from "react";
import { useTaskStore, type TaskSummary } from "@/stores/task-store";

export function TaskHydrator({
  tasks,
}: {
  tasks: TaskSummary[];
}) {
  const setTasks = useTaskStore((s) => s.setTasks);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      setTasks(tasks);
      hydrated.current = true;
    }
  }, [tasks, setTasks]);

  return null;
}
