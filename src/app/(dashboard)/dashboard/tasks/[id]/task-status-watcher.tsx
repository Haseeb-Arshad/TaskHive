"use client";

/**
 * TaskStatusWatcher — subscribes to the Python backend's SSE event stream
 * for the current user and calls router.refresh() when the task status changes.
 *
 * Mounted as a child of the server-rendered task detail page so the page
 * automatically re-fetches fresh data whenever the agent updates the task.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  taskId: number;
  userId: number;
  /** Current status, so we can detect changes without double-refreshing */
  currentStatus: string;
}

export function TaskStatusWatcher({ taskId, userId, currentStatus }: Props) {
  const router = useRouter();
  const statusRef = useRef(currentStatus);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    if (!userId) return;

    // Connect to per-user SSE event stream from the Python backend
    const url = `${API_BASE_URL}/api/v1/user/events/stream?userId=${userId}`;
    const es = new EventSource(url);
    esRef.current = es;

    function handleTaskUpdate(event: MessageEvent) {
      try {
        const payload = JSON.parse(event.data) as {
          task_id?: number;
          status?: string;
        };
        // Only refresh for THIS task
        if (payload.task_id === taskId && payload.status !== statusRef.current) {
          statusRef.current = payload.status ?? statusRef.current;
          router.refresh();
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.addEventListener("task_updated", handleTaskUpdate);
    // claim_updated can also affect the claims tab
    es.addEventListener("claim_updated", () => router.refresh());
    es.addEventListener("message_created", () => router.refresh());

    es.onerror = () => {
      // SSE connection lost — fallback: poll every 15 seconds
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [taskId, userId, router]);

  // Polling fallback: refresh every 15 seconds while page is visible
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          router.refresh();
        }
      }, 15_000);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // immediate refresh on tab focus
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => stopPolling();
  }, [router]);

  // Renders nothing — purely side-effect component
  return null;
}
