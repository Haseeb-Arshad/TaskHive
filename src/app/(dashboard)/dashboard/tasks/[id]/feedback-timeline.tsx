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

interface ThreadNode {
  id: number;
  sender: string;
  senderType: string;
  content: string;
  messageType: string;
  createdAt: string;
  children: ThreadNode[];
}

const MAX_TREE_DEPTH = 6;

function toTime(ts: string | undefined): number {
  if (!ts) return 0;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
}

function isRemarkDone(remark: any) {
  if (!remark?.evaluation) return true;
  const questions = remark.evaluation?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return true;
  return questions.every((q: any) => !!q?.answer);
}

function buildThread(
  parentId: number,
  byParent: Map<number, any[]>,
  depth = 0,
): ThreadNode[] {
  if (depth >= MAX_TREE_DEPTH) return [];
  const children = byParent.get(parentId) || [];
  return children.map((msg) => ({
    id: msg.id,
    sender: msg.sender_name || (msg.sender_type === "poster" ? "You" : "Agent"),
    senderType: msg.sender_type || "agent",
    content: msg.content || "",
    messageType: msg.message_type || "text",
    createdAt: msg.created_at || "",
    children: buildThread(msg.id, byParent, depth + 1),
  }));
}

function FollowupTree({ nodes, depth = 0 }: { nodes: ThreadNode[]; depth?: number }) {
  if (nodes.length === 0) return null;
  return (
    <div className={`${depth > 0 ? "ml-5 pl-4 border-l border-stone-200" : ""} space-y-3`}>
      {nodes.map((node) => {
        const isPoster = node.senderType === "poster";
        const isQuestion = node.messageType === "question";
        return (
          <div key={node.id} className="rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isPoster ? "bg-[#E5484D]" : "bg-blue-500"}`} />
              <span className="text-[11px] font-semibold text-stone-700">{node.sender}</span>
              <span className="rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-stone-500">
                {isQuestion ? "Question" : isPoster ? "Reply" : "Follow-up"}
              </span>
              <span className="ml-auto text-[10px] text-stone-400">
                {node.createdAt ? new Date(node.createdAt).toLocaleString() : ""}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">{node.content}</p>
            {node.children.length > 0 && <FollowupTree nodes={node.children} depth={depth + 1} />}
          </div>
        );
      })}
    </div>
  );
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

  const firstIncompleteIndex = useMemo(() => {
    const idx = agentRemarks.findIndex((r) => !isRemarkDone(r));
    return idx === -1 ? agentRemarks.length : idx;
  }, [agentRemarks]);

  useEffect(() => {
    if (agentRemarks.length === 0) return;
    const next = firstIncompleteIndex === agentRemarks.length
      ? agentRemarks.length - 1
      : firstIncompleteIndex;
    setActiveStep(next);
  }, [agentRemarks.length, firstIncompleteIndex]);

  const sortedMessages = useMemo(() => {
    return [...taskMessages]
      .filter((m) => m && typeof m.id === "number")
      .sort((a, b) => toTime(a.created_at) - toTime(b.created_at));
  }, [taskMessages]);

  const treeByRemarkIndex = useMemo(() => {
    const result = new Map<number, ThreadNode[]>();
    if (sortedMessages.length === 0 || agentRemarks.length === 0) return result;

    const byParent = new Map<number, any[]>();
    for (const msg of sortedMessages) {
      if (msg.parent_id == null) continue;
      const list = byParent.get(msg.parent_id) || [];
      list.push(msg);
      byParent.set(msg.parent_id, list);
    }

    const usedRootIds = new Set<number>();
    for (let idx = 0; idx < agentRemarks.length; idx++) {
      const remark = agentRemarks[idx];
      const remarkText = String(remark?.remark || "").trim();
      const remarkTs = toTime(remark?.timestamp);
      const agentId = Number(remark?.agent_id || 0);

      let candidates = sortedMessages.filter((m) => {
        if (usedRootIds.has(m.id)) return false;
        if (m.sender_type !== "agent") return false;
        if (agentId && Number(m.sender_id || 0) !== agentId) return false;
        return ["evaluation", "remark", "text"].includes(String(m.message_type || ""));
      });

      if (remarkText) {
        const exact = candidates.filter((m) => String(m.content || "").trim() === remarkText);
        if (exact.length > 0) candidates = exact;
      }

      if (candidates.length === 0) {
        result.set(idx, []);
        continue;
      }

      candidates.sort((a, b) => {
        const aDelta = Math.abs(toTime(a.created_at) - remarkTs);
        const bDelta = Math.abs(toTime(b.created_at) - remarkTs);
        return aDelta - bDelta;
      });

      const root = candidates[0];
      usedRootIds.add(root.id);
      result.set(idx, buildThread(root.id, byParent));
    }

    return result;
  }, [agentRemarks, sortedMessages]);

  if (agentRemarks.length === 0) return null;

  return (
    <div className="pl-12 pt-2">
      {agentRemarks.slice(0, activeStep + 1).map((remark, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === activeStep;
        const isDone = idx < firstIncompleteIndex;
        const isPrevDone = idx === 0 || idx - 1 < firstIncompleteIndex;
        const treeNodes = treeByRemarkIndex.get(idx) || [];

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

            <div className="pt-px space-y-3">
              {remark.evaluation ? (
                <EvaluationCard
                  remark={remark}
                  taskId={taskId}
                  relatedClaim={claims.find((c: any) => c.agent_id === remark.agent_id)}
                  readOnly={readOnly}
                  taskStatus={taskStatus}
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

              {treeNodes.length > 0 && (
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Follow-up Thread</p>
                  <FollowupTree nodes={treeNodes} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {activeStep < agentRemarks.length - 1 && isRemarkDone(agentRemarks[activeStep]) && (
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
