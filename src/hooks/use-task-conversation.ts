"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
    (s) => s.messagesByTask.get(taskId)
  );
  const messages = messagesFromStore ?? EMPTY_MESSAGES;
  const loading = useConversationStore(
    (s) => s.loadingByTask.has(taskId) ? s.loadingByTask.get(taskId)! : true
  );
  const setMessages = useConversationStore((s) => s.setMessages);
  const appendMessage = useConversationStore((s) => s.appendMessage);
  const setLoading = useConversationStore((s) => s.setLoading);
  const fetchedRef = useRef(false);

  // Fetch messages on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchMessages() {
      setLoading(taskId, true);
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
        // Silently fail — messages will show empty state
      } finally {
        setLoading(taskId, false);
      }
    }

    fetchMessages();
  }, [taskId, userId, setMessages, setLoading]);

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
          // Refetch messages to get the reply
          const msgRes = await fetch(
            `${API_BASE_URL}/api/v1/user/tasks/${taskId}/messages?limit=100`,
            {
              headers: {
                "Content-Type": "application/json",
                "X-User-ID": String(userId),
              },
            }
          );
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setMessages(taskId, msgData.messages || []);
          }
          return data;
        }
      } catch {
        // handled by caller
      }
      return null;
    },
    [taskId, userId, setMessages]
  );

  // Refetch messages (used when SSE event arrives)
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

  return {
    messages,
    loading,
    sendMessage,
    respondToQuestion,
    refetch,
  };
}
