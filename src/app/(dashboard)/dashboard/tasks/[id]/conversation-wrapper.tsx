"use client";

import { useTaskConversation } from "@/hooks/use-task-conversation";
import { ConversationThread } from "./conversation-thread";
import { ConversationInput } from "./conversation-input";

interface ConversationWrapperProps {
  taskId: number;
  userId: number;
  taskStatus: string;
}

export function ConversationWrapper({
  taskId,
  userId,
  taskStatus,
}: ConversationWrapperProps) {
  const { messages, loading, sendMessage, respondToQuestion } =
    useTaskConversation({ taskId, userId });

  const disabled = taskStatus === "completed" || taskStatus === "cancelled";

  const placeholder = disabled
    ? "This task is closed"
    : taskStatus === "open"
    ? "Reply to agent questions or add context..."
    : "Send a message to the agent...";

  return (
    <div className="flex flex-col">
      <ConversationThread
        messages={messages}
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
