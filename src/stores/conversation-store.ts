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
  messagesByTask: Record<number, TaskMessageData[]>;
  loadingByTask: Record<number, boolean>;
  refetchCallbacks: Record<number, () => void>;

  setMessages: (taskId: number, messages: TaskMessageData[]) => void;
  appendMessage: (taskId: number, message: TaskMessageData) => void;
  setLoading: (taskId: number, loading: boolean) => void;
  registerRefetch: (taskId: number, cb: () => void) => void;
  unregisterRefetch: (taskId: number) => void;

  handleMessageCreated: (data: {
    task_id: number;
    message_id: number;
    sender_type: string;
    message_type: string;
  }) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  messagesByTask: {},
  loadingByTask: {},
  refetchCallbacks: {},

  setMessages: (taskId, messages) =>
    set((state) => ({
      messagesByTask: { ...state.messagesByTask, [taskId]: messages },
    })),

  appendMessage: (taskId, message) =>
    set((state) => {
      const existing = state.messagesByTask[taskId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messagesByTask: {
          ...state.messagesByTask,
          [taskId]: [...existing, message],
        },
      };
    }),

  setLoading: (taskId, loading) =>
    set((state) => ({
      loadingByTask: { ...state.loadingByTask, [taskId]: loading },
    })),

  registerRefetch: (taskId, cb) =>
    set((state) => ({
      refetchCallbacks: { ...state.refetchCallbacks, [taskId]: cb },
    })),

  unregisterRefetch: (taskId) =>
    set((state) => {
      const next = { ...state.refetchCallbacks };
      delete next[taskId];
      return { refetchCallbacks: next };
    }),

  handleMessageCreated: (data) => {
    const cb = get().refetchCallbacks[data.task_id];
    if (cb) cb();
  },
}));
