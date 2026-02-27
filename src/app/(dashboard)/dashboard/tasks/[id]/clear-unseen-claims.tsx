"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/stores/task-store";

export function ClearUnseenClaims({ taskId }: { taskId: number }) {
  const markClaimsSeen = useTaskStore((s) => s.markClaimsSeen);

  useEffect(() => {
    markClaimsSeen(taskId);
  }, [taskId, markClaimsSeen]);

  return null;
}
