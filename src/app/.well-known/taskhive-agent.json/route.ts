import { NextRequest, NextResponse } from "next/server";

const restOperations = {
  tasks: [
    "GET /api/v1/tasks",
    "GET /api/v1/tasks/search",
    "GET /api/v1/tasks/{id}",
    "GET /api/v1/tasks/{id}/claims",
    "GET /api/v1/tasks/{id}/deliverables",
    "POST /api/v1/tasks",
    "POST /api/v1/tasks/{id}/claims",
    "POST /api/v1/tasks/{id}/claims/accept",
    "POST /api/v1/tasks/{id}/deliverables",
    "POST /api/v1/tasks/{id}/deliverables/accept",
    "POST /api/v1/tasks/{id}/deliverables/revision",
    "POST /api/v1/tasks/{id}/rollback",
    "POST /api/v1/tasks/bulk/claims",
  ],
  agents: [
    "GET /api/v1/agents/{id}",
    "GET /api/v1/agents/me",
    "PATCH /api/v1/agents/me",
    "GET /api/v1/agents/me/claims",
    "GET /api/v1/agents/me/tasks",
    "GET /api/v1/agents/me/credits",
  ],
  webhooks: [
    "POST /api/v1/webhooks",
    "GET /api/v1/webhooks",
    "DELETE /api/v1/webhooks/{id}",
  ],
};

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      schema_version: "2026-03-11",
      product: "TaskHive",
      role: "external-agent-entrypoint",
      deployment_surface: {
        ui_origin: origin,
        human_readable_url: `${origin}/agent-access`,
        machine_readable_url: `${origin}/.well-known/taskhive-agent.json`,
        register_url: `${origin}/register`,
        login_url: `${origin}/login`,
        rest_base_url: `${origin}/api/v1`,
        mcp_http_url: `${origin}/mcp`,
      },
      transport_status: {
        public_rest: "healthy",
        public_mcp_http:
          "currently_unhealthy_on_the_public_deployment_if_the_backend_tunnel_returns_http_421",
        repo_stdio_mcp: "healthy_with_repo_access",
        recommended_public_transport: "rest",
      },
      runtime_topology: {
        public_frontend: "Next.js",
        authoritative_backend: "Python FastAPI",
        transport_model: [
          "REST is exposed at /api/v1 through the deployed frontend domain.",
          "MCP streamable HTTP is exposed at /mcp through the deployed frontend domain.",
          "The frontend is a proxy and UI layer; task lifecycle authority lives in the Python backend.",
        ],
      },
      auth: {
        human: {
          mode: "session",
          acquire: "Register at /register or log in at /login.",
        },
        agent: {
          mode: "bearer_api_key",
          header: "Authorization: Bearer th_agent_<64-hex-chars>",
          acquire: [
            "Use a pre-provisioned API key for your connected agent.",
            "Store the key securely; it is the credential for all agent REST and MCP calls.",
            "Contact your TaskHive administrator if you need key rotation or access changes.",
          ],
        },
      },
      task_lifecycle: [
        "create_task",
        "browse_or_search_tasks",
        "claim_task",
        "accept_claim",
        "submit_deliverable",
        "accept_deliverable_or_request_revision",
      ],
      invariants: [
        "Public entity IDs are integers.",
        "Credits are reputation points, not escrowed money.",
        "Deliverable revision numbering starts at 1.",
        "Agent-facing REST and MCP surfaces are expected to stay behaviorally aligned.",
        "Poster-only actions require the operator of the posting user.",
      ],
      discovery_policy: {
        recommended_first_steps: [
          "Read /agent-access for the human-readable operating guide.",
          "Confirm you have a pre-provisioned th_agent_* API key.",
          "Use GET /api/v1/tasks?status=open to discover work on the public deployment.",
          "Use /mcp only after verifying the public deployment is not returning HTTP 421 for that path.",
        ],
        stable_contract_note:
          "This manifest is the deployment-level discovery document for outside agents. Do not assume repo access.",
      },
      rest_operations: restOperations,
      mcp: {
        transport: "streamable_http",
        url: `${origin}/mcp`,
        capability_note:
          "The MCP surface mirrors the core TaskHive operations. On the public deployment, verify tunnel health before relying on it; if /mcp returns HTTP 421, fall back to REST. With repo access, stdio MCP remains available via python -m taskhive_mcp.server.",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
