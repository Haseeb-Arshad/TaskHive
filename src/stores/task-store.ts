import { create } from "zustand";

export interface TaskSummary {
  id: number;
  title: string;
  status: string;
  budget_credits: number;
  category_name: string | null;
  created_at: string;
  deadline: string | null;
  claims_count: number;
}

interface TaskStore {
  // Cache
  tasks: Map<number, TaskSummary>;
  taskList: TaskSummary[] | null;
  lastFetchedAt: number;

  // Unseen claims
  unseenClaims: Map<number, number>;

  // Actions
  setTasks: (tasks: TaskSummary[]) => void;
  updateTask: (id: number, partial: Partial<TaskSummary>) => void;
  markClaimsSeen: (taskId: number) => void;
  initUnseenClaims: () => void;

  // SSE event handlers
  handleTaskUpdated: (data: { task_id: number; status: string }) => void;
  handleTaskCreated: (data: { task_id: number; title: string; status: string }) => void;
  handleClaimCreated: (data: { task_id: number }) => void;
  handleDeliverableSubmitted: (data: { task_id: number }) => void;

  // Staleness
  isStale: () => boolean;
}

function loadUnseenClaims(): Map<number, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem("taskhive_unseen_claims");
    if (raw) {
      const entries: [number, number][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch {}
  return new Map();
}

function persistUnseenClaims(map: Map<number, number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("taskhive_unseen_claims", JSON.stringify([...map.entries()]));
  } catch {}
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: new Map(),
  taskList: null,
  lastFetchedAt: 0,
  unseenClaims: new Map(),

  setTasks: (tasks) => {
    const map = new Map<number, TaskSummary>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    set({ tasks: map, taskList: tasks, lastFetchedAt: Date.now() });
  },

  updateTask: (id, partial) => {
    const { tasks, taskList } = get();
    const existing = tasks.get(id);
    if (!existing) return;

    const updated = { ...existing, ...partial };
    const newMap = new Map(tasks);
    newMap.set(id, updated);

    const newList = taskList
      ? taskList.map((t) => (t.id === id ? updated : t))
      : null;

    set({ tasks: newMap, taskList: newList });
  },

  handleTaskUpdated: (data) => {
    get().updateTask(data.task_id, { status: data.status });
  },

  handleTaskCreated: (_data) => {
    // Force a full refresh — new task needs all fields
    set({ lastFetchedAt: 0 });
  },

  markClaimsSeen: (taskId) => {
    const { unseenClaims } = get();
    if (!unseenClaims.has(taskId)) return;
    const newMap = new Map(unseenClaims);
    newMap.delete(taskId);
    set({ unseenClaims: newMap });
    persistUnseenClaims(newMap);
  },

  initUnseenClaims: () => {
    set({ unseenClaims: loadUnseenClaims() });
  },

  handleClaimCreated: (data) => {
    const { tasks, unseenClaims } = get();
    const existing = tasks.get(data.task_id);
    if (existing) {
      get().updateTask(data.task_id, {
        claims_count: existing.claims_count + 1,
      });
    }
    const newMap = new Map(unseenClaims);
    newMap.set(data.task_id, (newMap.get(data.task_id) || 0) + 1);
    set({ unseenClaims: newMap });
    persistUnseenClaims(newMap);
  },

  handleDeliverableSubmitted: (data) => {
    get().updateTask(data.task_id, { status: "delivered" });
  },

  isStale: () => {
    return Date.now() - get().lastFetchedAt > 60_000;
  },
}));
