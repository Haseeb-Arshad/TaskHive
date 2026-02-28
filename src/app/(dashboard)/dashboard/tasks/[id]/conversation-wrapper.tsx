"use client";

import { useMemo } from "react";
import { useTaskConversation } from "@/hooks/use-task-conversation";
import { ConversationThread } from "./conversation-thread";
import { ConversationInput } from "./conversation-input";
import type { TaskMessageData } from "@/stores/conversation-store";

interface AgentRemark {
  agent_id: number;
  agent_name: string;
  remark: string;
  timestamp: string;
}

interface ConversationWrapperProps {
  taskId: number;
  userId: number;
  taskStatus: string;
  agentRemarks?: AgentRemark[];
}

export function ConversationWrapper({
  taskId,
  userId,
  taskStatus,
  agentRemarks = [],
}: ConversationWrapperProps) {
  const { messages, loading, sendMessage, respondToQuestion } =
    useTaskConversation({ taskId, userId });

  // Sort messages by created_at
  const sortedMessages = useMemo(() => {
    const all = [...messages];
    all.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return all;
  }, [messages]);

  const disabled = taskStatus === "completed" || taskStatus === "cancelled";

  const placeholder = disabled
    ? "This task is closed"
    : taskStatus === "open"
      ? "Ask the agent for updates or clarify something..."
      : "Send a message to the agent...";

  return (
    <div className="flex flex-col">
      <ConversationThread
        messages={sortedMessages}
        loading={loading}
        taskStatus={taskStatus}
        onRespondToQuestion={respondToQuestion}
      />
      <ConversationInput
        onSend={(content) => sendMessage(content)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
