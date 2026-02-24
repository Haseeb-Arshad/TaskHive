"use client";

import { AgentReputationBadge } from "@/components/agent-reputation-badge";
import { TaskActions } from "./actions";

interface ClaimCardProps {
  claim: {
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
  };
  taskId: number;
  taskStatus: string;
  taskBudget: number;
}

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "h-12 w-12 text-lg" : "h-7 w-7 text-xs";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-stone-800 font-bold text-stone-200 ${dims}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ClaimCard({
  claim,
  taskId,
  taskStatus,
  taskBudget,
}: ClaimCardProps) {
  const budgetPct = Math.min(
    100,
    Math.round((claim.proposed_credits / taskBudget) * 100)
  );

  // Parse message into approach steps (if numbered list)
  const approachSteps: string[] = [];
  if (claim.message) {
    const lines = claim.message.split("\n").filter((l) => l.trim());
    let isNumbered = false;
    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)/);
      if (match) {
        isNumbered = true;
        approachSteps.push(match[1]);
      }
    }
    if (!isNumbered) {
      approachSteps.length = 0; // Not a numbered list — will show as plain text
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors ${
        claim.status === "accepted"
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      {/* Header: Avatar + Name + Badge */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={claim.agent_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-stone-900">
              {claim.agent_name}
            </span>
            <AgentReputationBadge tier={claim.reputation_tier} />
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                claim.status === "pending"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : claim.status === "accepted"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : claim.status === "rejected"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-stone-200 bg-stone-100 text-stone-500"
              }`}
            >
              {claim.status}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-stone-400">
            <span>
              Rep:{" "}
              <span className="font-semibold text-stone-600">
                {claim.reputation_score?.toFixed(0) ?? 50}
              </span>
            </span>
            <span>
              Tasks:{" "}
              <span className="font-semibold text-stone-600">
                {claim.tasks_completed}
              </span>
            </span>
            {claim.avg_rating && (
              <span>
                Rating:{" "}
                <span className="font-semibold text-stone-600">
                  {claim.avg_rating.toFixed(1)}
                </span>
              </span>
            )}
            <span>{new Date(claim.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Capabilities chips */}
      {claim.capabilities && claim.capabilities.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {claim.capabilities.slice(0, 6).map((cap, i) => (
            <span
              key={i}
              className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600"
            >
              {cap}
            </span>
          ))}
          {claim.capabilities.length > 6 && (
            <span className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-400">
              +{claim.capabilities.length - 6} more
            </span>
          )}
        </div>
      )}

      {/* Approach / Message */}
      {claim.message && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
            Approach
          </p>
          {approachSteps.length > 0 ? (
            <ol className="space-y-1.5">
              {approachSteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-stone-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-500">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-relaxed text-stone-700">
              {claim.message}
            </p>
          )}
        </div>
      )}

      {/* Budget bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-stone-400">Proposed</span>
          <span className="font-semibold text-stone-700">
            {claim.proposed_credits}{" "}
            <span className="text-stone-400">/ {taskBudget} credits</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-stone-800 transition-all"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Accept button */}
      {claim.status === "pending" && taskStatus === "open" && (
        <TaskActions
          action="acceptClaim"
          taskId={taskId}
          itemId={claim.id}
          label="Accept Claim"
        />
      )}
    </div>
  );
}
