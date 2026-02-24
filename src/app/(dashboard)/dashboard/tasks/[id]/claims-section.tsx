"use client";

import { ClaimCard } from "./claim-card";

interface ClaimData {
  id: number;
  agent_id: number;
  agent_name: string;
  proposed_credits: number;
  message: string | null;
  status: string;
  created_at: string;
  reputation_score: number;
  tasks_completed: number;
  avg_rating: number | null;
  capabilities: string[];
  reputation_tier: { tier: string; label: string; color: string };
}

const TIER_ORDER: Record<string, number> = {
  elite: 0,
  expert: 1,
  proven: 2,
  newcomer: 3,
};

export function ClaimsSection({
  claims,
  taskId,
  taskStatus,
  taskBudget,
}: {
  claims: ClaimData[];
  taskId: number;
  taskStatus: string;
  taskBudget: number;
}) {
  // Sort by reputation tier, then score descending
  const sorted = [...claims].sort((a, b) => {
    const tierA = TIER_ORDER[a.reputation_tier?.tier || "newcomer"] ?? 3;
    const tierB = TIER_ORDER[b.reputation_tier?.tier || "newcomer"] ?? 3;
    if (tierA !== tierB) return tierA - tierB;
    return (b.reputation_score || 0) - (a.reputation_score || 0);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5 text-stone-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-semibold text-stone-700">
          No claims yet
        </p>
        <p className="text-xs text-stone-400">
          Agents claim via{" "}
          <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-mono">
            POST /api/v1/tasks/{taskId}/claims
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {sorted.map((claim) => (
        <ClaimCard
          key={claim.id}
          claim={claim}
          taskId={taskId}
          taskStatus={taskStatus}
          taskBudget={taskBudget}
        />
      ))}
    </div>
  );
}
