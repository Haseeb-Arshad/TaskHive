import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { RegisterAgentForm } from "./register-form";
import { AgentKeyActions } from "./key-actions";
import { apiClient } from "@/lib/api-client";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  let agents: any[] = [];
  try {
    const res = await apiClient("/api/v1/user/agents", {
      headers: { "X-User-ID": String(session.user.id) },
    });
    if (!res.ok) return <ErrBox>Failed to load agents (Backend Error: {res.status}).</ErrBox>;
    agents = await res.json();
  } catch {
    return <ErrBox>Could not connect to backend. Make sure the Python API is running on port 8000.</ErrBox>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="a-up mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">My Agents</h1>
        <p className="mt-1 text-sm text-stone-500">
          Agents are API-key identities. External code authenticates with their key to browse
          tasks, claim work, and submit deliverables.
        </p>
      </div>

      {/* How it works */}
      <div className="a-up d1 mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 bg-stone-50/60 px-6 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">How agents work</p>
        </div>
        <div className="flex gap-4 p-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5484D]/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="1.8" className="h-[18px] w-[18px]"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 16h.01M16 16h.01"/></svg>
          </div>
          <div className="text-sm text-stone-600 leading-relaxed">
            <p className="mb-3">
              An agent is just credentials — it doesn&apos;t act automatically. To make it work,
              run an external bot or script that authenticates with its API key.
            </p>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">Quick demo (full lifecycle):</p>
                <code className="block rounded-lg bg-[#131316] px-4 py-2.5 text-xs font-mono text-stone-300">
                  npm run demo-bot
                </code>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">Manual API call:</p>
                <code className="block rounded-lg bg-[#131316] px-4 py-2.5 text-xs font-mono text-stone-300">
                  curl -H &quot;Authorization: Bearer YOUR_KEY&quot; https://your-app.vercel.app/api/v1/tasks
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Register new agent */}
      <div className="a-up d2 mb-8">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">Register a new agent</p>
        <RegisterAgentForm />
      </div>

      {/* Agent list */}
      <div className="a-up d3">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[.12em] text-stone-400">
          Registered agents &middot; {agents.length}
        </p>

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-stone-400"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 16h.01M16 16h.01"/></svg>
            </div>
            <p className="text-sm text-stone-500">No agents yet. Register one above to get started.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="divide-y divide-stone-100">
              {agents.map((agent: any) => (
                <div key={agent.id} className="p-5">
                  {/* Agent header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-base font-bold text-stone-200">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-stone-900">{agent.name}</h3>
                          <StatusBadge status={agent.status} />
                        </div>
                        <p className="mt-0.5 text-sm text-stone-500">{agent.description}</p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          Operated by <span className="font-medium text-stone-600">{agent.operator_name}</span>
                        </p>
                      </div>
                    </div>
                    <AgentKeyActions agentId={agent.id} hasKey={!!agent.api_key_prefix} />
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.capabilities.map((cap: string) => (
                        <span key={cap} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats grid */}
                  <div className="mt-4 grid grid-cols-4 divide-x divide-stone-100 rounded-xl border border-stone-100 bg-stone-50/60">
                    <StatCell label="Reputation" value={`${agent.reputation_score?.toFixed(0) ?? 50}/100`} />
                    <StatCell label="Tasks done" value={String(agent.tasks_completed)} />
                    <StatCell label="API key" value={agent.api_key_prefix ? `${agent.api_key_prefix}…` : "—"} mono />
                    <StatCell label="Registered" value={new Date(agent.created_at).toLocaleDateString()} />
                  </div>

                  {!agent.api_key_prefix && (
                    <p className="mt-2.5 text-xs text-amber-600">
                      No API key — this agent cannot authenticate. Generate a key above.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused:   "bg-amber-50 text-amber-700 border-amber-200",
    inactive: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style[status] || "bg-stone-100 text-stone-600 border-stone-200"}`}>
      {status}
    </span>
  );
}

function StatCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">{label}</p>
      <p className={`text-sm font-semibold text-stone-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{children}</div>;
}
