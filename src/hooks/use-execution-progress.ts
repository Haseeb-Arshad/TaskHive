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

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    setSteps([]);
    setConnected(false);

    function connect() {
      if (!executionId || !mountedRef.current) return;

      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(
        `/orchestrator/progress/executions/${executionId}/stream`
      );
      esRef.current = es;

      es.addEventListener("progress", (e) => {
        if (!mountedRef.current) return;
        const step: ProgressStep = JSON.parse(e.data);
        setSteps((prev) => {
          if (prev.some((s) => s.index === step.index)) return prev;
          return [...prev, step].sort((a, b) => a.index - b.index);
        });
      });

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

    connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
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
