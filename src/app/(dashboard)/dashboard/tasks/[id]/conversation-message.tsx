"use client";

import type { TaskMessageData } from "@/stores/conversation-store";
import { AgentReputationBadge } from "@/components/agent-reputation-badge";
import { StructuredQuestion } from "./structured-question";

interface ConversationMessageProps {
  message: TaskMessageData;
  onRespondToQuestion?: (
    messageId: number,
    response: string,
    optionIndex?: number
  ) => void;
  taskStatus: string;
}

function MessageAvatar({
  name,
  senderType,
}: {
  name: string;
  senderType: string;
}) {
  const bg =
    senderType === "agent"
      ? "bg-stone-800 text-stone-200"
      : "bg-[#E5484D] text-white";
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${bg}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ConversationMessage({
  message,
  onRespondToQuestion,
  taskStatus,
}: ConversationMessageProps) {
  const isSystem = message.sender_type === "system";
  const isPoster = message.sender_type === "poster";
  const isAgent = message.sender_type === "agent";
  const disabled = taskStatus === "completed" || taskStatus === "cancelled";

  // System messages — centered pill
  if (isSystem || message.message_type === "status_change") {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-stone-100 px-4 py-1.5 text-xs font-medium text-stone-500">
          {message.content}
        </span>
      </div>
    );
  }

  // Claim proposal — special card
  if (message.message_type === "claim_proposal") {
    const data = message.structured_data as Record<string, unknown> | null;
    const credits = (data?.proposed_credits as number) ?? 0;
    const claimMessage = (data?.message as string) || message.content;

    return (
      <div className="flex gap-3 py-3">
        <MessageAvatar name={message.sender_name} senderType="agent" />
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {message.sender_name}
            </span>
            {message.reputation_tier && (
              <AgentReputationBadge tier={message.reputation_tier} />
            )}
            <span className="text-xs text-stone-400">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Claim Proposal
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-sky-900">
                {credits} <span className="text-xs text-sky-600">credits</span>
              </span>
            </div>
            {claimMessage && (
              <p className="text-sm leading-relaxed text-sky-800">
                {claimMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Remark — agent feedback with skip indicator
  if (message.message_type === "remark") {
    return (
      <div className="flex gap-3 py-3">
        <MessageAvatar name={message.sender_name} senderType="agent" />
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {message.sender_name}
            </span>
            {message.reputation_tier && (
              <AgentReputationBadge tier={message.reputation_tier} />
            )}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
              Skipped
            </span>
            <span className="text-xs text-stone-400">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-amber-900">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Poster message — right-aligned
  if (isPoster) {
    return (
      <div className="flex justify-end gap-3 py-3">
        <div className="max-w-[75%]">
          <div className="mb-1 flex items-center justify-end gap-2">
            <span className="text-xs text-stone-400">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-sm font-semibold text-stone-900">You</span>
          </div>
          <div className="rounded-2xl rounded-tr-md bg-[#FFF1F2] border border-[#E5484D]/10 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Agent message — left-aligned (text, question, attachment, revision_request)
  return (
    <div className="flex gap-3 py-3">
      <MessageAvatar name={message.sender_name} senderType="agent" />
      <div className="max-w-[75%] min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-900">
            {message.sender_name}
          </span>
          {message.reputation_tier && (
            <AgentReputationBadge tier={message.reputation_tier} />
          )}
          <span className="text-xs text-stone-400">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
            {message.content}
          </p>
          {message.message_type === "question" && message.structured_data && (
            <StructuredQuestion
              structuredData={message.structured_data}
              onRespond={(response, optionIndex) =>
                onRespondToQuestion?.(message.id, response, optionIndex)
              }
              disabled={disabled}
            />
          )}
          {message.message_type === "revision_request" && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Revision Request
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
