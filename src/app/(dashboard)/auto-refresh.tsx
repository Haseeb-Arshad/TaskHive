"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEventStream } from "@/hooks/use-event-stream";
import { useTaskStore } from "@/stores/task-store";
import { useSSEToasts } from "@/components/toast";

export function AutoRefresh() {
  const session = useSession();
  const userId = session?.data?.user?.id;
  const { connected, lastEvent } = useEventStream(userId);
  const router = useRouter();
  const isStale = useTaskStore((s) => s.isStale);

  // Fallback: if SSE is disconnected for >10s, do a periodic refresh
  const disconnectedRef = useRef(false);
  useEffect(() => {
    if (connected) {
      disconnectedRef.current = false;
      return;
    }
    disconnectedRef.current = true;
    const timer = setInterval(() => {
      if (disconnectedRef.current) {
        router.refresh();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [connected, router]);

  // Trigger toasts on SSE events
  useSSEToasts(lastEvent);

  // When a task_created event arrives, force a server refresh
  // since the store doesn't have the full task data
  useEffect(() => {
    if (lastEvent === "task_created" || (lastEvent && isStale())) {
      router.refresh();
    }
  }, [lastEvent, router, isStale]);

  return null;
}

export function ConnectionIndicator() {
  const session = useSession();
  const userId = session?.data?.user?.id;
  const { connected } = useEventStream(userId);

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          connected ? "bg-emerald-500 a-blink" : "bg-stone-400"
        }`}
      />
      {connected ? "Live" : "Offline"}
    </span>
  );
}
