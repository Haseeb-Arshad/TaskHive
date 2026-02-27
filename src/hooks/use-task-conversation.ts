"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useConversationStore,
  type TaskMessageData,
} from "@/stores/conversation-store";
import { API_BASE_URL } from "@/lib/api-client";

const EMPTY_MESSAGES: TaskMessageData[] = [];

interface UseTaskConversationOptions {
  taskId: number;
  userId: number;
}

export function useTaskConversation({
  taskId,
  userId,
}: UseTaskConversationOptions) {
  const messagesFromStore = useConversationStore(
    (s) => s.messagesByTask[taskId]
  );
  const messages = messagesFromStore ?? EMPTY_MESSAGES;
  const loading = useConversationStore(
    (s) => taskId in s.loadingByTask ? s.loadingByTask[taskId] : true
  );
  const setMessages = useConversationStore((s) => s.setMessages);
  const appendMessage = useConversationStore((s) => s.appendMessage);
  const setLoading = useConversationStore((s) => s.setLoading);
  const registerRefetch = useConversationStore((s) => s.registerRefetch);
  const unregisterRefetch = useConversationStore((s) => s.unregisterRefetch);
  const fetchedRef = useRef(false);

  // Refetch messages from backend
  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/user/tasks/${taskId}/messages?limit=100`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(userId),
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(taskId, data.messages || []);
      }
    } catch {
      // silent
    }
  }, [taskId, userId, setMessages]);

  // Fetch messages on mount + register refetch callback for SSE
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(taskId, true);
      refetch().finally(() => setLoading(taskId, false));
    }

    // Register so SSE message_created events trigger a refetch
    registerRefetch(taskId, refetch);
    return () => unregisterRefetch(taskId);
  }, [taskId, refetch, setLoading, registerRefetch, unregisterRefetch]);

  // Send a text message
  const sendMessage = useCallback(
    async (content: string, messageType = "text") => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/user/tasks/${taskId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": String(userId),
            },
            body: JSON.stringify({ content, message_type: messageType }),
          }
        );
        if (res.ok) {
          const msg: TaskMessageData = await res.json();
          appendMessage(taskId, msg);
          return msg;
        }
      } catch {
        // handled by caller
      }
      return null;
    },
    [taskId, userId, appendMessage]
  );

  // Respond to a structured question
  const respondToQuestion = useCallback(
    async (messageId: number, response: string, optionIndex?: number) => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/user/tasks/${taskId}/messages/${messageId}/respond`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": String(userId),
            },
            body: JSON.stringify({
              response,
              option_index: optionIndex ?? null,
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          await refetch();
          return data;
        }
      } catch {
        // handled by caller
      }
      return null;
    },
    [taskId, userId, refetch]
  );

  return {
    messages,
    loading,
    sendMessage,
    respondToQuestion,
    refetch,
  };
}
