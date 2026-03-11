"use client";

import { useEffect, useMemo, useState } from "react";
import { EvaluationCard } from "./evaluation-card";

interface FeedbackTimelineProps {
  agentRemarks: any[];
  taskId: number;
  claims?: any[];
  readOnly?: boolean;
  taskStatus?: string;
  taskMessages?: any[];
}

function isRemarkDone(remark: any, responseMap: Record<string, string>) {
  if (!remark?.evaluation) return true;
  const questions = remark.evaluation?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return true;
  return questions.every((q: any, idx: number) => {
    const qid = String(q?.id || `q-${idx + 1}`);
    return !!q?.answer || !!responseMap[qid];
  });
}

export function FeedbackTimeline({
  agentRemarks,
  taskId,
  claims = [],
  readOnly = false,
  taskStatus,
  taskMessages = [],
}: FeedbackTimelineProps) {
  const [activeStep, setActiveStep] = useState(0);

  const responseMap = useMemo(() => {
    const map: Record<string, string> = {};
    let fallbackIndex = 0;
    for (const msg of taskMessages) {
      if (!msg || msg.message_type !== "question") continue;
      const structured = (msg.structured_data || {}) as Record<string, unknown>;
      const qid = String(structured.question_id || "").trim();
      const response = String(structured.response || "").trim();
      if (!response) continue;
      if (qid) {
        map[qid] = response;
        continue;
      }
      fallbackIndex += 1;
      const fallbackKey = `q-${fallbackIndex}`;
      if (!map[fallbackKey]) map[fallbackKey] = response;
    }
    return map;
  }, [taskMessages]);

  const firstIncompleteIndex = useMemo(() => {
    const idx = agentRemarks.findIndex((r) => !isRemarkDone(r, responseMap));
    return idx === -1 ? agentRemarks.length : idx;
  }, [agentRemarks, responseMap]);

  const claimRemarkIndexes = useMemo(() => {
    const indexes = new Map<number, any>();
    const firstRemarkIndexByAgent = new Map<number, number>();

    agentRemarks.forEach((remark, idx) => {
      const agentId = Number(remark?.agent_id);
      if (!Number.isFinite(agentId) || firstRemarkIndexByAgent.has(agentId)) return;
      firstRemarkIndexByAgent.set(agentId, idx);
    });

    claims.forEach((claim: any) => {
      const agentId = Number(claim?.agent_id);
      if (!Number.isFinite(agentId)) return;
      const remarkIndex = firstRemarkIndexByAgent.get(agentId);
      if (remarkIndex === undefined) return;
      if (!indexes.has(remarkIndex)) {
        indexes.set(remarkIndex, claim);
      }
    });

    return indexes;
  }, [agentRemarks, claims]);

  useEffect(() => {
    if (agentRemarks.length === 0) return;
    const next = firstIncompleteIndex === agentRemarks.length
      ? agentRemarks.length - 1
      : firstIncompleteIndex;
    setActiveStep(next);
  }, [agentRemarks.length, firstIncompleteIndex]);

  if (agentRemarks.length === 0) return null;

  return (
    <div className="pl-12 pt-2">
      {agentRemarks.slice(0, activeStep + 1).map((remark, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === activeStep;
        const isDone = idx < firstIncompleteIndex;
        const isPrevDone = idx === 0 || idx - 1 < firstIncompleteIndex;

        return (
          <div
            key={idx}
            className={`relative pb-8 last:pb-0 transition-opacity duration-500 ease-out ${isLast ? "opacity-100" : "opacity-90"}`}
            style={{ transitionDelay: `${idx * 100}ms` }}
          >
            <div className="absolute bottom-0 left-[-48px] top-0 flex w-12 flex-col items-center">
              <div className={`w-0.5 h-6 shrink-0 transition-colors duration-500 ${isFirst ? "bg-transparent" : isPrevDone ? "bg-emerald-500" : "bg-stone-200"}`} />
              {isDone ? (
                <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm ring-4 ring-white transition-all duration-300 scale-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 text-white">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <div className={`z-10 h-5 w-5 shrink-0 rounded-full border-[3px] bg-white ring-4 ring-white transition-colors duration-300 ${isLast ? "border-amber-400 animate-pulse" : "border-stone-200"}`} />
              )}
              {!(isLast && (!isDone || activeStep === agentRemarks.length - 1)) && (
                <div className={`w-0.5 flex-1 transition-colors duration-500 ${isDone ? "bg-emerald-500" : "bg-stone-200"}`} />
              )}
            </div>

            <div className="pt-px">
              {remark.evaluation ? (
                <EvaluationCard
                  remark={remark}
                  taskId={taskId}
                  relatedClaim={claimRemarkIndexes.get(idx)}
                  readOnly={readOnly}
                  taskStatus={taskStatus}
                  messageResponses={responseMap}
                />
              ) : (
                <div className="rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm transition-all hover:border-amber-300/80">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                      {(remark.agent_name || "A").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-amber-900">{remark.agent_name || "Agent"}</span>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isDone ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {isDone ? "Answered" : "Awaiting Reply"}
                    </span>
                    <span className="ml-auto text-[10px] text-amber-600/60">
                      {remark.timestamp ? new Date(remark.timestamp).toLocaleString() : ""}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-amber-900">{remark.remark}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {activeStep < agentRemarks.length - 1 && isRemarkDone(agentRemarks[activeStep], responseMap) && (
        <div className="relative pb-8 animate-in fade-in duration-1000">
          <div className="absolute bottom-0 left-[-48px] top-0 flex w-12 flex-col items-center">
            <div className="w-0.5 h-6 shrink-0 bg-emerald-500" />
            <div className="z-10 h-4 w-4 shrink-0 rounded-full border-4 border-stone-200 bg-white ring-4 ring-white shadow-sm" />
          </div>
          <div className="pt-2">
            <div className="flex h-12 w-fit items-center gap-3 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-5 text-stone-400">
              <div className="h-2 w-2 rounded-full bg-stone-300 animate-pulse" />
              <span className="text-xs font-semibold">Loading next step...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
