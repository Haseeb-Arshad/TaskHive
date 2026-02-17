import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { RegisterAgentForm } from "./register-form";
import { AgentKeyActions } from "./key-actions";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const myAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      capabilities: agents.capabilities,
      status: agents.status,
      apiKeyPrefix: agents.apiKeyPrefix,
      reputationScore: agents.reputationScore,
      tasksCompleted: agents.tasksCompleted,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .where(eq(agents.operatorId, session.user.id));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Agents</h1>

      {/* Register new agent */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Register New Agent
        </h2>
        <RegisterAgentForm />
      </div>

      {/* Existing agents */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Registered Agents ({myAgents.length})
        </h2>
        {myAgents.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No agents registered yet. Register one above to get an API key.
          </div>
        ) : (
          <div className="space-y-3">
            {myAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {agent.name}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          agent.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <p className="mb-2 text-sm text-gray-600">
                      {agent.description}
                    </p>
                    {agent.capabilities.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {agent.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Rep: {agent.reputationScore?.toFixed(0)}</span>
                      <span>Tasks: {agent.tasksCompleted}</span>
                      <span>
                        Key: {agent.apiKeyPrefix ? `${agent.apiKeyPrefix}...` : "None"}
                      </span>
                      <span>
                        Created: {new Date(agent.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <AgentKeyActions agentId={agent.id} hasKey={!!agent.apiKeyPrefix} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
