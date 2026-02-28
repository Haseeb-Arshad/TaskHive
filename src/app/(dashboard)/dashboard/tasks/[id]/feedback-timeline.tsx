"use client";

import { useState, useEffect, useMemo } from "react";
import { EvaluationCard } from "./evaluation-card";

interface FeedbackTimelineProps {
    agentRemarks: any[];
    taskId: number;
    claims?: any[];
}

export function FeedbackTimeline({ agentRemarks, taskId, claims = [] }: FeedbackTimelineProps) {
    // We want to show feedback items one by one.
    // A feedback item is considered "done" if it's an evaluation that has been fully answered,
    // or if it's a regular remark (which we treat as informative).

    const [activeStep, setActiveStep] = useState(0);

    // Helper to check if a remark is "completed"
    const isRemarkDone = (remark: any) => {
        if (!remark.evaluation) return true; // Informational remarks are always done
        const { questions } = remark.evaluation;
        if (!questions || questions.length === 0) return true;
        return questions.every((q: any) => !!q.answer);
    };

    // Find the first index that is NOT done
    const firstIncompleteIndex = useMemo(() => {
        const idx = agentRemarks.findIndex((r) => !isRemarkDone(r));
        return idx === -1 ? agentRemarks.length : idx;
    }, [agentRemarks]);

    // Update activeStep based on data changes, but allow it to be at most one past the last done item
    useEffect(() => {
        if (activeStep <= firstIncompleteIndex && activeStep < agentRemarks.length) {
            setActiveStep(Math.min(firstIncompleteIndex, agentRemarks.length - 1));
        }
    }, [firstIncompleteIndex, agentRemarks.length, activeStep]);

    if (agentRemarks.length === 0) return null;

    return (
        <div className="pl-12 pt-2">
            {agentRemarks.slice(0, activeStep + 1).map((remark, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === activeStep;
                const isDone = idx < firstIncompleteIndex;
                const isPrevDone = idx === 0 || (idx - 1 < firstIncompleteIndex);

                return (
                    <div
                        key={idx}
                        className={`relative pb-8 last:pb-0 transition-opacity duration-500 ease-out ${isLast ? "opacity-100" : "opacity-90"
                            }`}
                        style={{ transitionDelay: `${idx * 100}ms` }}
                    >
                        {/* Timeline Column */}
                        <div className="absolute bottom-0 left-[-48px] top-0 flex w-12 flex-col items-center">

                            {/* Upper segment */}
                            <div className={`w-0.5 h-6 shrink-0 transition-colors duration-500 ${isFirst ? 'bg-transparent' : (isPrevDone ? 'bg-emerald-500' : 'bg-stone-200')
                                }`} />

                            {/* Node */}
                            {isDone ? (
                                <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm ring-4 ring-white transition-all duration-300 scale-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 text-white">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                            ) : (
                                <div className={`z-10 h-5 w-5 shrink-0 rounded-full border-[3px] bg-white ring-4 ring-white transition-colors duration-300 ${isLast ? "border-amber-400 animate-pulse" : "border-stone-200"
                                    }`} />
                            )}

                            {/* Lower segment */}
                            {!(isLast && (!isDone || activeStep === agentRemarks.length - 1)) && (
                                <div className={`w-0.5 flex-1 transition-colors duration-500 ${isDone ? "bg-emerald-500" : "bg-stone-200"
                                    }`} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="pt-px">
                            {remark.evaluation ? (
                                <EvaluationCard
                                    remark={remark}
                                    taskId={taskId}
                                    relatedClaim={claims.find((c: any) => c.agent_id === remark.agent_id)}
                                />
                            ) : (
                                <div className="rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm transition-all hover:border-amber-300/80">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                                            {(remark.agent_name || "A").charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs font-semibold text-amber-900">
                                            {remark.agent_name || "Agent"}
                                        </span>
                                        <span className="ml-auto text-[10px] text-amber-600/60">
                                            {remark.timestamp ? new Date(remark.timestamp).toLocaleString() : ""}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed text-amber-900">
                                        {remark.remark}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Placeholder for loading next */}
            {activeStep < agentRemarks.length - 1 && isRemarkDone(agentRemarks[activeStep]) && (
                <div className="relative pb-8 animate-in fade-in duration-1000">
                    <div className="absolute bottom-0 left-[-48px] top-0 flex w-12 flex-col items-center">
                        {/* Upper segment */}
                        <div className="w-0.5 h-6 shrink-0 bg-emerald-500" />
                        {/* Node */}
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
