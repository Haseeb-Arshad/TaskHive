"use client";

import { useState } from "react";

interface StructuredQuestionProps {
  structuredData: Record<string, unknown>;
  onRespond: (response: string, optionIndex?: number) => void;
  disabled?: boolean;
}

export function StructuredQuestion({
  structuredData,
  onRespond,
  disabled = false,
}: StructuredQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [submitted, setSubmitted] = useState(
    !!(structuredData as any)?.responded_at
  );

  const questionType =
    (structuredData as any)?.question_type || "multiple_choice";
  const options = ((structuredData as any)?.options || []) as string[];
  const prompt = (structuredData as any)?.prompt || "";
  const existingResponse = (structuredData as any)?.response;

  if (submitted || existingResponse) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-xs font-semibold text-emerald-700">Answered</p>
        <p className="mt-1 text-sm text-emerald-800">
          {existingResponse || "Response submitted"}
        </p>
      </div>
    );
  }

  if (questionType === "yes_no") {
    return (
      <div className="mt-3 flex gap-2">
        <button
          disabled={disabled}
          onClick={() => {
            setSubmitted(true);
            onRespond("Yes", 0);
          }}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
        >
          Yes
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            setSubmitted(true);
            onRespond("No", 1);
          }}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          No
        </button>
      </div>
    );
  }

  if (questionType === "text_input") {
    return (
      <div className="mt-3">
        {prompt && (
          <p className="mb-2 text-xs text-stone-500">{prompt}</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={disabled}
            placeholder="Type your answer..."
            className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none disabled:opacity-50"
          />
          <button
            disabled={disabled || !textInput.trim()}
            onClick={() => {
              setSubmitted(true);
              onRespond(textInput.trim());
            }}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  // Multiple choice (default)
  return (
    <div className="mt-3 space-y-2">
      {options.map((option: string, idx: number) => (
        <button
          key={idx}
          disabled={disabled}
          onClick={() => setSelected(idx)}
          className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
            selected === idx
              ? "border-[#E5484D]/40 bg-[#FFF1F2] text-[#E5484D] ring-1 ring-[#E5484D]/20"
              : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
          } disabled:opacity-50`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                selected === idx
                  ? "border-[#E5484D] bg-[#E5484D] text-white"
                  : "border-stone-300"
              }`}
            >
              {selected === idx && "\u2713"}
            </span>
            {option}
          </span>
        </button>
      ))}
      {selected !== null && (
        <button
          disabled={disabled}
          onClick={() => {
            setSubmitted(true);
            onRespond(options[selected], selected);
          }}
          className="mt-2 w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
