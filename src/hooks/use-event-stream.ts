"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { useTaskStore } from "@/stores/task-store";
import { useConversationStore } from "@/stores/conversation-store";

/**
 * Singleton SSE connection state — shared across all components
 * that call useEventStream(). Only ONE EventSource is ever created.
 */
interface SSEState {
  connected: boolean;
  lastEvent: string | null;
  _es: EventSource | null;
  _retries: number;
  _userId: number | null;
  _refCount: number;
}

const useSSEStore = create<SSEState>(() => ({
  connected: false,
  lastEvent: null,
  _es: null,
  _retries: 0,
  _userId: null,
  _refCount: 0,
}));

const MAX_RETRIES = 10;

function connectSSE(userId: number) {
  const state = useSSEStore.getState();

  // Already connected to this user
  if (state._es && state._userId === userId) return;

  // Close stale connection
  if (state._es) {
    state._es.close();
  }

  const es = new EventSource(
    `/api/v1/user/events/stream?userId=${userId}`
  );

  useSSEStore.setState({ _es: es, _userId: userId, _retries: 0 });

  es.addEventListener("connected", () => {
    useSSEStore.setState({ connected: true, _retries: 0 });
  });

  es.addEventListener("task_updated", (e) => {
    const data = JSON.parse(e.data);
    useTaskStore.getState().handleTaskUpdated(data);
    useSSEStore.setState({ lastEvent: "task_updated" });
  });

  es.addEventListener("task_created", (e) => {
    const data = JSON.parse(e.data);
    useTaskStore.getState().handleTaskCreated(data);
    useSSEStore.setState({ lastEvent: "task_created" });
  });

  es.addEventListener("claim_created", (e) => {
    const data = JSON.parse(e.data);
    useTaskStore.getState().handleClaimCreated(data);
    useSSEStore.setState({ lastEvent: "claim_created" });
  });

  es.addEventListener("claim_updated", (e) => {
    const data = JSON.parse(e.data);
    useTaskStore.getState().handleTaskUpdated(data);
    useSSEStore.setState({ lastEvent: "claim_updated" });
  });

  es.addEventListener("deliverable_submitted", (e) => {
    const data = JSON.parse(e.data);
    useTaskStore.getState().handleDeliverableSubmitted(data);
    useSSEStore.setState({ lastEvent: "deliverable_submitted" });
  });

  es.addEventListener("message_created", (e) => {
    const data = JSON.parse(e.data);
    useConversationStore.getState().handleMessageCreated(data);
    useSSEStore.setState({ lastEvent: "message_created" });
  });

  es.onerror = () => {
    useSSEStore.setState({ connected: false });
    es.close();

    const { _retries, _refCount } = useSSEStore.getState();
    useSSEStore.setState({ _es: null });

    // Only reconnect if someone is still subscribed
    if (_refCount > 0 && _retries < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** _retries, 30000);
      useSSEStore.setState({ _retries: _retries + 1 });
      setTimeout(() => {
        if (useSSEStore.getState()._refCount > 0) {
          connectSSE(userId);
        }
      }, delay);
    }
  };
}

function disconnectSSE() {
  const state = useSSEStore.getState();
  if (state._es) {
    state._es.close();
    useSSEStore.setState({ _es: null, connected: false, _userId: null });
  }
}

export function useEventStream(userId: number | undefined) {
  const connected = useSSEStore((s) => s.connected);
  const lastEvent = useSSEStore((s) => s.lastEvent);

  useEffect(() => {
    if (!userId) return;

    // Increment ref count
    useSSEStore.setState((s) => ({ _refCount: s._refCount + 1 }));

    // Connect if not already
    connectSSE(userId);

    return () => {
      // Decrement ref count
      const newCount = useSSEStore.getState()._refCount - 1;
      useSSEStore.setState({ _refCount: newCount });

      // Disconnect only when all consumers unmount
      if (newCount <= 0) {
        disconnectSSE();
      }
    };
  }, [userId]);

  return { connected, lastEvent };
}
