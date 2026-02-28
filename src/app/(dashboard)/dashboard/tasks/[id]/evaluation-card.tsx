"use client";

import { useState, useTransition } from "react";
import { submitEvaluationAnswers, acceptClaim } from "@/lib/actions/tasks";

interface EvaluationQuestion {
  id: string;
  text: string;
  type: "multiple_choice" | "yes_no" | "text_input" | "scale";
  options?: string[];
  placeholder?: string;
  scale_min?: number;
  scale_max?: number;
  scale_labels?: [string, string];
  answer?: string;
  answered_at?: string;
}

interface EvaluationData {
  score: number;
  strengths: string[];
  concerns: string[];
  questions: EvaluationQuestion[];
}

interface RemarkWithEvaluation {
  agent_id: number;
  agent_name: string;
  remark: string;
  timestamp: string;
  evaluation: EvaluationData;
}

export function EvaluationCard({
  remark,
  taskId,
  relatedClaim,
}: {
  remark: RemarkWithEvaluation;
  taskId: number;
  relatedClaim?: any;
}) {
  const { evaluation } = remark;
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(
    evaluation.questions.length > 0 && evaluation.questions.every((q) => !!q.answer)
  );
  const [isPending, startTransition] = useTransition();

  const unansweredCount = evaluation.questions.filter(
    (q) => !q.answer && !selections[q.id]
  ).length;
  const hasNewAnswers = Object.keys(selections).length > 0;

  const scoreColor =
    evaluation.score <= 3
      ? "bg-red-500"
      : evaluation.score <= 6
        ? "bg-amber-500"
        : "bg-emerald-500";
  const scoreBarBg =
    evaluation.score <= 3
      ? "bg-red-100"
      : evaluation.score <= 6
        ? "bg-amber-100"
        : "bg-emerald-100";
  const scoreLabelColor =
    evaluation.score <= 3
      ? "text-red-700"
      : evaluation.score <= 6
        ? "text-amber-700"
        : "text-emerald-700";

  function setAnswer(id: string, value: string) {
    setSelections((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const answers = Object.entries(selections).map(([question_id, answer]) => ({
      question_id,
      answer,
    }));
    if (answers.length === 0) return;
    startTransition(async () => {
      const result = await submitEvaluationAnswers(taskId, remark.agent_id, answers);
      if (result.success) setSubmitted(true);
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-200 text-sm font-bold text-violet-800">
          {(remark.agent_name || "A").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {remark.agent_name || "Agent"}
            </span>
            <span className="rounded-full bg-violet-200/70 px-2 py-0.5 text-[10px] font-bold text-violet-800">
              Evaluation
            </span>
          </div>
          <span className="text-[10px] text-stone-400">
            {remark.timestamp ? new Date(remark.timestamp).toLocaleString() : ""}
          </span>
        </div>
        {/* Score pill */}
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${scoreBarBg}`}>
          <span className={`text-sm font-bold ${scoreLabelColor}`}>
            {evaluation.score}/10
          </span>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* ── Score bar ────────────────────────── */}
        <div className={`h-1.5 rounded-full ${scoreBarBg}`}>
          <div
            className={`h-1.5 rounded-full transition-all ${scoreColor}`}
            style={{ width: `${evaluation.score * 10}%` }}
          />
        </div>

        {/* ── Feedback ─────────────────────────── */}
        <p className="text-sm leading-relaxed text-stone-700">{remark.remark}</p>

        {/* ── Strengths & Concerns side by side ── */}
        {(evaluation.strengths.length > 0 || evaluation.concerns.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {evaluation.strengths.length > 0 && (
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-600 mb-2">
                  Strengths
                </p>
                <ul className="space-y-1.5">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-emerald-900">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.concerns.length > 0 && (
              <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-600 mb-2">
                  To clarify
                </p>
                <ul className="space-y-1.5">
                  {evaluation.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-amber-900">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Questions ────────────────────────── */}
        {evaluation.questions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
                Quick questions
              </p>
              {!submitted && unansweredCount > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  {unansweredCount} remaining
                </span>
              )}
              {submitted && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  All answered
                </span>
              )}
            </div>

            <div className="space-y-5">
              {evaluation.questions.map((q, qIdx) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  index={qIdx}
                  value={selections[q.id]}
                  onChange={(val) => setAnswer(q.id, val)}
                  disabled={submitted || isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Submit ───────────────────────────── */}
        {!submitted && hasNewAnswers && (
          <button
            disabled={isPending}
            onClick={handleSubmit}
            className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white transition-all hover:bg-stone-800 active:scale-[0.99] disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              `Submit ${Object.keys(selections).length} answer${Object.keys(selections).length !== 1 ? "s" : ""}`
            )}
          </button>
        )}

        {/* ── Related Claim ─────────────────── */}
        {relatedClaim && (
          <RelatedClaimPanel claim={relatedClaim} taskId={taskId} />
        )}
      </div>
    </div>
  );
}

/* ── Individual question renderers ──────────────── */

function QuestionRenderer({
  question: q,
  index,
  value,
  onChange,
  disabled,
}: {
  question: EvaluationQuestion;
  index: number;
  value?: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const isAnswered = !!(q.answer || (disabled && value));
  const displayAnswer = q.answer || value;

  if (isAnswered) {
    // Multi-select answers are comma-separated — display as tags
    const answerParts = displayAnswer ? displayAnswer.split(", ").filter(Boolean) : [];
    return (
      <div>
        <p className="text-sm font-medium text-stone-700 mb-1.5">
          <span className="text-stone-400 mr-1.5">{index + 1}.</span>
          {q.text}
        </p>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {answerParts.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {answerParts.map((part, i) => (
                  <span key={i} className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    {part}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-800">{displayAnswer}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-stone-800 mb-2.5">
        <span className="text-stone-400 mr-1.5">{index + 1}.</span>
        {q.text}
      </p>

      {q.type === "yes_no" && (
        <YesNoInput value={value} onChange={onChange} disabled={disabled} />
      )}
      {q.type === "multiple_choice" && (
        <McqInput options={q.options || []} value={value} onChange={onChange} disabled={disabled} />
      )}
      {q.type === "text_input" && (
        <TextInput placeholder={q.placeholder} value={value} onChange={onChange} disabled={disabled} />
      )}
      {q.type === "scale" && (
        <ScaleInput
          min={q.scale_min ?? 1}
          max={q.scale_max ?? 5}
          labels={q.scale_labels}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function YesNoInput({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${
            value === opt
              ? opt === "Yes"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "border-red-300 bg-red-50 text-red-700 ring-1 ring-red-200"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
          } disabled:opacity-50`}
        >
          {opt === "Yes" ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><polyline points="20 6 9 17 4 12" /></svg>
              Yes
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              No
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function McqInput({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  // Multi-select: value is a comma-separated list of selected options
  const selected = value ? value.split(", ").filter(Boolean) : [];

  function toggleOption(option: string) {
    const next = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    onChange(next.join(", "));
  }

  return (
    <div className="space-y-1.5">
      {options.map((option, idx) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => toggleOption(option)}
            className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
              isSelected
                ? "border-[#E5484D]/40 bg-[#FFF1F2] text-[#E5484D] ring-1 ring-[#E5484D]/20"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
            } disabled:opacity-50`}
          >
            <span className="flex items-center gap-2.5">
              {/* Square checkbox to signal multi-select */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[10px] ${
                  isSelected
                    ? "border-[#E5484D] bg-[#E5484D] text-white"
                    : "border-stone-300"
                }`}
              >
                {isSelected && "\u2713"}
              </span>
              {option}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <p className="pt-0.5 text-[11px] text-stone-400">
          {selected.length} selected — you can pick multiple
        </p>
      )}
    </div>
  );
}

function TextInput({
  placeholder,
  value,
  onChange,
  disabled,
}: {
  placeholder?: string;
  value?: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={2}
      placeholder={placeholder || "Type your answer..."}
      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-50 resize-none"
    />
  );
}

function ScaleInput({
  min,
  max,
  labels,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  labels?: [string, string];
  value?: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const selected = value ? Number(value) : null;

  return (
    <div>
      <div className="flex gap-1.5">
        {steps.map((step) => (
          <button
            key={step}
            disabled={disabled}
            onClick={() => onChange(String(step))}
            className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${
              selected === step
                ? "border-violet-400 bg-violet-100 text-violet-800 ring-1 ring-violet-200"
                : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            } disabled:opacity-50`}
          >
            {step}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[10px] text-stone-400">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

/* ── Related Claim Panel ─────────────────────────── */

function RelatedClaimPanel({ claim, taskId }: { claim: any; taskId: number }) {
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(claim.status === "accepted");

  // Parse approach into steps if numbered list
  const approachSteps: string[] = [];
  if (claim.message) {
    const lines = claim.message.split("\n").filter((l: string) => l.trim());
    let isNumbered = false;
    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)/);
      if (match) {
        isNumbered = true;
        approachSteps.push(match[1]);
      }
    }
    if (!isNumbered) approachSteps.length = 0;
  }

  async function handleAccept() {
    setAccepting(true);
    const result = await acceptClaim(taskId, claim.id);
    if (result.success) setAccepted(true);
    setAccepting(false);
  }

  return (
    <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-stone-600">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          This Agent&apos;s Claim
        </p>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium ${
          accepted
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : claim.status === "rejected"
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}>
          {accepted ? "accepted" : claim.status}
        </span>
      </div>

      {/* Credits */}
      <div className="mb-3 flex items-center justify-between rounded-lg bg-white border border-stone-100 px-3 py-2">
        <span className="text-xs text-stone-500">Proposed credits</span>
        <span className="text-sm font-bold text-stone-800">{claim.proposed_credits}</span>
      </div>

      {/* Approach */}
      {claim.message && (
        <div className="mb-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.08em] text-stone-400">Implementation Approach</p>
          {approachSteps.length > 0 ? (
            <ol className="space-y-1.5">
              {approachSteps.map((step: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-stone-600">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-500">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs leading-relaxed text-stone-600">{claim.message}</p>
          )}
        </div>
      )}

      {/* Accept button */}
      {!accepted && claim.status === "pending" && (
        <button
          disabled={accepting}
          onClick={handleAccept}
          className="mt-1 w-full rounded-lg bg-stone-900 py-2 text-xs font-semibold text-white transition-all hover:bg-stone-800 active:scale-[0.99] disabled:opacity-50"
        >
          {accepting ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Accepting...
            </span>
          ) : (
            "Accept this Claim"
          )}
        </button>
      )}
    </div>
  );
}
