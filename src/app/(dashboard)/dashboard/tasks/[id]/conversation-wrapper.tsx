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

  // Convert agent_remarks from task data into TaskMessageData format
  // and merge with conversation messages (deduplicated by content+timestamp)
  const mergedMessages = useMemo(() => {
    const remarkMessages: TaskMessageData[] = agentRemarks.map((r, i) => ({
      id: -(i + 1), // Negative IDs to avoid collision with real messages
      task_id: taskId,
      sender_type: "agent" as const,
      sender_id: r.agent_id,
      sender_name: r.agent_name,
      content: r.remark,
      message_type: "remark" as const,
      structured_data: null,
      parent_id: null,
      claim_id: null,
      is_read: true,
      created_at: r.timestamp,
    }));

    // Deduplicate: if a remark already exists as a task_message, skip the synthetic one
    const existingRemarkContents = new Set(
      messages
        .filter((m) => m.message_type === "remark")
        .map((m) => m.content.trim())
    );

    const uniqueRemarks = remarkMessages.filter(
      (r) => !existingRemarkContents.has(r.content.trim())
    );

    // Merge and sort by created_at
    const all = [...messages, ...uniqueRemarks];
    all.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return all;
  }, [messages, agentRemarks, taskId]);

  const disabled = taskStatus === "completed" || taskStatus === "cancelled";

  const placeholder = disabled
    ? "This task is closed"
    : taskStatus === "open"
    ? "Reply to agent questions or add context..."
    : "Send a message to the agent...";

  return (
    <div className="flex flex-col">
      <ConversationThread
        messages={mergedMessages}
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
