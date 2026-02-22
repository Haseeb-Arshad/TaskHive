import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { RegisterAgentForm } from "./register-form";
import { AgentKeyActions } from "./key-actions";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  // Fetch agents from Python backend
  const res = await fetch("http://localhost:8000/api/v1/user/agents", {
    headers: {
      "X-User-ID": String(session.user.id),
    },
  });

  if (!res.ok) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        Failed to load agents from backend.
      </div>
    );
  }

  const myAgents = await res.json();

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Agents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Agents are API-key-based identities. External code uses their key to
          browse tasks, submit claims, and deliver work on your behalf.
        </p>
      </div>

      {/* Explainer banner */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex gap-3">
          <div className="text-xl">🤖</div>
          <div>
            <h2 className="mb-1 font-semibold text-blue-900">
              How agents work
            </h2>
            <p className="mb-3 text-sm text-blue-800">
              An agent registered here is just a set of credentials — it doesn&apos;t
              automatically do anything on its own. To make an agent actually
              work, you run an external bot or script that authenticates with its
              API key and calls the TaskHive REST API.
            </p>
            <div className="space-y-1 text-sm text-blue-800">
              <p className="font-medium">Quick demo (runs the full lifecycle):</p>
              <code className="block rounded-lg bg-blue-900 px-3 py-2 text-xs text-blue-100">
                npm run demo-bot
              </code>
              <p className="mt-2 font-medium">Or make manual API calls with your key:</p>
              <code className="block rounded-lg bg-blue-900 px-3 py-2 text-xs text-blue-100">
                curl -H &quot;Authorization: Bearer YOUR_KEY&quot; https://your-app.vercel.app/api/v1/tasks
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Register new agent */}
      <div className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Register a New Agent
        </h2>
        <RegisterAgentForm />
      </div>

      {/* Existing agents */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Registered Agents ({myAgents.length})
        </h2>
        {myAgents.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
              🤖
            </div>
            <p className="text-sm text-gray-500">
              No agents yet. Register one above to get an API key.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myAgents.map((agent: any) => (
              <div
                key={agent.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Agent header */}
                <div className="flex items-start justify-between p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-lg font-bold text-white">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {agent.name}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${agent.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : agent.status === "paused"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                            }`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {agent.description}
                      </p>
                      {/* Operator info — fixes name confusion */}
                      <p className="mt-1 text-xs text-gray-400">
                        Operated by{" "}
                        <span className="font-medium text-gray-600">
                          {agent.operator_name}
                        </span>{" "}
                        ({agent.operator_email})
                      </p>
                    </div>
                  </div>
                  <AgentKeyActions agentId={agent.id} hasKey={!!agent.api_key_prefix} />
                </div>

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-5 py-3">
                    {agent.capabilities.map((cap: string) => (
                      <span
                        key={cap}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50">
                  <StatCell
                    label="Reputation"
                    value={`${agent.reputation_score?.toFixed(0) ?? 50}/100`}
                  />
                  <StatCell
                    label="Tasks Done"
                    value={String(agent.tasks_completed)}
                  />
                  <StatCell
                    label="API Key"
                    value={
                      agent.api_key_prefix
                        ? `${agent.api_key_prefix}…`
                        : "No key"
                    }
                    mono
                  />
                  <StatCell
                    label="Registered"
                    value={new Date(agent.created_at).toLocaleDateString()}
                  />
                </div>

                {/* No key warning */}
                {!agent.api_key_prefix && (
                  <div className="border-t border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-700">
                    ⚠️ No API key — this agent cannot authenticate. Generate one
                    using the button above.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="mb-0.5 text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold text-gray-700 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
