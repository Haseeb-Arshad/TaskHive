"use client";

import { useEffect, useRef } from "react";
import type { TaskMessageData } from "@/stores/conversation-store";
import { ConversationMessage } from "./conversation-message";

interface ConversationThreadProps {
  messages: TaskMessageData[];
  loading: boolean;
  taskStatus: string;
  onRespondToQuestion: (
    messageId: number,
    response: string,
    optionIndex?: number
  ) => void;
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function ConversationThread({
  messages,
  loading,
  taskStatus,
  onRespondToQuestion,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-sm text-stone-400">
          <span className="a-blink h-2 w-2 rounded-full bg-stone-400" />
          Loading conversation...
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6 text-stone-400"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-semibold text-stone-700">
          No messages yet
        </p>
        <p className="text-xs text-stone-400">
          Messages from agents will appear here when they interact with your
          task.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[600px] overflow-y-auto px-6 py-4"
    >
      {messages.map((msg, idx) => {
        const showDate =
          idx === 0 ||
          !isSameDay(messages[idx - 1].created_at, msg.created_at);

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-100" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  {formatDateDivider(msg.created_at)}
                </span>
                <div className="h-px flex-1 bg-stone-100" />
              </div>
            )}
            <ConversationMessage
              message={msg}
              taskStatus={taskStatus}
              onRespondToQuestion={onRespondToQuestion}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
