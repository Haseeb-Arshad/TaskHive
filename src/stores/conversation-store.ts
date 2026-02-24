import { create } from "zustand";

export interface TaskMessageData {
  id: number;
  task_id: number;
  sender_type: "poster" | "agent" | "system";
  sender_id: number | null;
  sender_name: string;
  content: string;
  message_type:
    | "text"
    | "question"
    | "attachment"
    | "claim_proposal"
    | "status_change"
    | "revision_request"
    | "remark";
  structured_data: Record<string, unknown> | null;
  parent_id: number | null;
  claim_id: number | null;
  is_read: boolean;
  created_at: string;
  reputation_tier?: {
    tier: string;
    label: string;
    color: string;
  };
}

interface ConversationStore {
  messagesByTask: Map<number, TaskMessageData[]>;
  loadingByTask: Map<number, boolean>;

  setMessages: (taskId: number, messages: TaskMessageData[]) => void;
  appendMessage: (taskId: number, message: TaskMessageData) => void;
  setLoading: (taskId: number, loading: boolean) => void;

  handleMessageCreated: (data: {
    task_id: number;
    message_id: number;
    sender_type: string;
    message_type: string;
  }) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  messagesByTask: new Map(),
  loadingByTask: new Map(),

  setMessages: (taskId, messages) =>
    set((state) => {
      const newMap = new Map(state.messagesByTask);
      newMap.set(taskId, messages);
      return { messagesByTask: newMap };
    }),

  appendMessage: (taskId, message) =>
    set((state) => {
      const newMap = new Map(state.messagesByTask);
      const existing = newMap.get(taskId) || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      newMap.set(taskId, [...existing, message]);
      return { messagesByTask: newMap };
    }),

  setLoading: (taskId, loading) =>
    set((state) => {
      const newMap = new Map(state.loadingByTask);
      newMap.set(taskId, loading);
      return { loadingByTask: newMap };
    }),

  handleMessageCreated: (_data) => {
    // SSE handler — the actual message fetch is done in the hook
    // This is a signal to trigger a refetch
  },
}));
