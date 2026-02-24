"use client";

import { useRef, useState } from "react";

interface ConversationInputProps {
  onSend: (content: string) => Promise<unknown>;
  disabled?: boolean;
  placeholder?: string;
}

export function ConversationInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: ConversationInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

  return (
    <div className="border-t border-stone-200 bg-white px-6 py-4">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none disabled:opacity-50"
          style={{ minHeight: "44px", maxHeight: "160px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || sending || !value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-white transition-colors hover:bg-stone-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          {sending ? (
            <span className="a-blink h-2 w-2 rounded-full bg-current" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-stone-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
