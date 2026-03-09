"use client";

import { useEffect, useRef, useState } from "react";

export interface ProgressStep {
  index: number;
  subtask_id?: number | null;
  phase: string;
  title: string;
  description: string;
  detail: string;
  progress_pct: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface ExecutionProgress {
  steps: ProgressStep[];
  currentPhase: string | null;
  progressPct: number;
  connected: boolean;
}

const MAX_RETRIES = 8;

export function useExecutionProgress(
  executionId: number | null
): ExecutionProgress {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    setSteps([]);
    setConnected(false);

    function mergeStepLists(prev: ProgressStep[], incoming: ProgressStep[]): ProgressStep[] {
      if (incoming.length === 0) return prev;
      const map = new Map<number, ProgressStep>();
      for (const p of prev) {
        if (typeof p.index === "number") map.set(p.index, p);
      }
      for (const step of incoming) {
        if (typeof step.index !== "number") continue;
        const existing = map.get(step.index);
        if (!existing) {
          map.set(step.index, step);
          continue;
        }
        // Keep the richer/newer version of the same index
        const next =
          JSON.stringify(existing) === JSON.stringify(step)
            ? existing
            : { ...existing, ...step };
        map.set(step.index, next);
      }
      return Array.from(map.values()).sort((a, b) => a.index - b.index);
    }

    function connect() {
      if (!executionId || !mountedRef.current) return;

      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(
        `/api/orchestrator/progress/executions/${executionId}/stream`
      );
      esRef.current = es;

      const onProgress = (e: MessageEvent<string>) => {
        if (!mountedRef.current) return;
        try {
          const step: ProgressStep = JSON.parse(e.data);
          setSteps((prev) => mergeStepLists(prev, [step]));
        } catch {
          // Ignore malformed events
        }
      };

      es.addEventListener("progress", onProgress);
      // Fallback for stream implementations that don't set explicit event names.
      es.onmessage = onProgress;

      es.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          retriesRef.current = 0;
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!mountedRef.current) return;

        setConnected(false);

        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.min(3000 * 2 ** retriesRef.current, 30000);
          retriesRef.current += 1;
          timerRef.current = setTimeout(connect, delay);
        }
      };
    }

    async function pollSnapshot() {
      if (!executionId || !mountedRef.current) return;
      try {
        const res = await fetch(`/api/orchestrator/progress/executions/${executionId}`);
        if (!res.ok) return;
        const json = await res.json();
        const nextSteps = Array.isArray(json?.data?.steps) ? (json.data.steps as ProgressStep[]) : [];
        setSteps((prev) => mergeStepLists(prev, nextSteps));
      } catch {
        // Ignore snapshot polling errors
      }
    }

    connect();
    pollSnapshot();
    pollRef.current = setInterval(pollSnapshot, 3000);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [executionId]);

  const currentPhase = steps.length > 0 ? steps[steps.length - 1].phase : null;
  const progressPct =
    steps.length > 0 ? steps[steps.length - 1].progress_pct : 0;

  return { steps, currentPhase, progressPct, connected };
}
