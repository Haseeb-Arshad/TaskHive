"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(
    evaluation.questions.length > 0 && evaluation.questions.every((q) => !!q.answer)
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unansweredCount = evaluation.questions.filter(
    (q) => !q.answer && !selections[q.id]
  ).length;
  const hasNewAnswers = Object.keys(selections).length > 0;

  // Hide the entire form if it's already answered, or if it wasn't answered
  // and we don't need to force them to answer anymore.
  // submitted means we successfully sent answers to backend just now.
  const isPreviouslyAnswered = evaluation.questions.some(q => q.answer);
  const isReadOnly = submitted || isPreviouslyAnswered;

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
    setSubmitError(null);
    startTransition(async () => {
      const result = await submitEvaluationAnswers(taskId, remark.agent_id, answers);
      if (result.success) {
        setSubmitted(true);
        // Refresh page data so the server sees the updated answers.
        // We don't use revalidatePath() in the server action (avoids Vercel
        // timeout when the Python backend is cold), so refresh from client.
        router.refresh();
      } else if (result.error) {
        setSubmitError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-sky-50 border-b border-blue-100 px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-200 text-sm font-bold text-blue-800">
          {(remark.agent_name || "A").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {remark.agent_name || "Agent"}
            </span>
            <span className="rounded-full bg-blue-200/70 px-2 py-0.5 text-[10px] font-bold text-blue-800">
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

        {/* ── Follow-up Questions ───────────────── */}
        {evaluation.questions.length > 0 && !isReadOnly && (
          <div className="pt-4 mt-2 border-t border-stone-100">
            <h4 className="mb-4 text-sm font-bold text-stone-900">
              Agent&apos;s Clarification
            </h4>
            <div className="space-y-6">
              {evaluation.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-3">
                  <p className="text-sm font-medium leading-normal text-stone-800">
                    <span className="mr-2 text-stone-400 font-bold">{idx + 1}.</span>
                    {q.text}
                  </p>
                  <div className="pl-6">
                    {q.type === "text_input" && (
                      <TextInput
                        placeholder={q.placeholder}
                        value={selections[q.id]}
                        onChange={(v) => setAnswer(q.id, v)}
                        disabled={isPending}
                      />
                    )}
                    {q.type === "yes_no" && (
                      <YesNoInput
                        value={selections[q.id]}
                        onChange={(v) => setAnswer(q.id, v)}
                        disabled={isPending}
                      />
                    )}
                    {q.type === "multiple_choice" && (
                      <McqInput
                        options={q.options || []}
                        value={selections[q.id]}
                        onChange={(v) => setAnswer(q.id, v)}
                        disabled={isPending}
                      />
                    )}
                    {q.type === "scale" && (
                      <ScaleInput
                        min={q.scale_min ?? 1}
                        max={q.scale_max ?? 5}
                        labels={q.scale_labels}
                        value={selections[q.id]}
                        onChange={(v) => setAnswer(q.id, v)}
                        disabled={isPending}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 flex gap-2 text-sm text-red-700">
                {/* Assuming AlertCircle is imported or defined */}
                {/* <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" /> */}
                <p>{submitError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-2">
              <span className="text-xs font-medium text-stone-500">
                {unansweredCount > 0
                  ? `${unansweredCount} question${unansweredCount !== 1 ? "s" : ""} left`
                  : "All answered!"}
              </span>

              {selections && (
                <button
                  onClick={handleSubmit}
                  disabled={isPending || unansweredCount > 0}
                  className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-40"
                >
                  {isPending ? "Submitting..." : "Submit Answers"}
                </button>
              )}
            </div>
          </div>
        )}

        {isReadOnly && isPreviouslyAnswered && (
          <div className="pt-4 mt-2 border-t border-stone-100">
            <h4 className="mb-4 text-sm font-bold text-stone-900 flex items-center gap-2">
              Agent&apos;s Clarification
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone-500 font-bold border border-stone-200">Submitted</span>
            </h4>
            <div className="space-y-4">
              {evaluation.questions.map((q, idx) => {
                if (!q.answer) return null;
                return (
                  <div key={q.id || idx} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                    <p className="text-sm font-medium leading-normal text-stone-800 mb-2">
                      <span className="mr-2 text-stone-400 font-bold">{idx + 1}.</span>
                      {q.text}
                    </p>
                    <div className="pl-6 border-l-2 border-stone-200 mt-2">
                      <p className="text-sm text-blue-700 font-semibold">{q.answer || selections[q.id]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Submit ───────────────────────────── */}
        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {submitError} — please try again.
          </div>
        )}
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
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${value === opt
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
  // Multi-select: value is a pipe-separated list of selected options ("|||" avoids conflicts with option text)
  const selected = value ? value.split("|||").filter(Boolean) : [];

  function toggleOption(option: string) {
    const next = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    onChange(next.join("|||"));
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
            className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${isSelected
              ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
              : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
              } disabled:opacity-50`}
          >
            <span className="flex items-center gap-2.5">
              {/* Square checkbox to signal multi-select */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[10px] ${isSelected
                  ? "border-blue-600 bg-blue-600 text-white"
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
      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 resize-none"
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
            className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${selected === step
              ? "border-blue-400 bg-blue-100 text-blue-800 ring-1 ring-blue-200"
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
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(claim.status === "accepted");
  const [acceptError, setAcceptError] = useState<string | null>(null);

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
    setAcceptError(null);
    const result = await acceptClaim(taskId, claim.id);
    if (result.success) {
      setAccepted(true);
      // After accepting a claim, switch to the activity tab
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "activity");
      window.history.replaceState(null, "", url.toString());
      // Refresh page so ClaimsSection, task status banner, etc. all update
      router.refresh();
    } else if (result.error) {
      setAcceptError(result.error);
    }
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
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium ${accepted
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

      {/* Accept error */}
      {acceptError && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {acceptError}
        </p>
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
