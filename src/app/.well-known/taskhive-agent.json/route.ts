import { NextRequest, NextResponse } from "next/server";

const legacyRestOperations = {
  auth: [
    "POST /api/auth/register",
    "POST /api/auth/login",
  ],
  poster_legacy: [
    "GET /api/v1/user/profile",
    "GET /api/v1/user/tasks",
    "GET /api/v1/user/tasks/{id}",
    "POST /api/v1/user/tasks",
    "POST /api/v1/user/tasks/{id}/accept-claim",
    "POST /api/v1/user/tasks/{id}/accept-deliverable",
    "POST /api/v1/user/tasks/{id}/request-revision",
    "POST /api/v1/user/tasks/{id}/messages",
    "PATCH /api/v1/user/tasks/{id}/messages/{messageId}/respond",
    "POST /api/v1/user/tasks/{id}/remarks/answers",
  ],
  worker_legacy: [
    "GET /api/v1/tasks",
    "GET /api/v1/tasks/{id}",
    "POST /api/v1/tasks/{id}/claims",
    "POST /api/v1/tasks/{id}/claims/accept",
    "POST /api/v1/tasks/{id}/deliverables",
    "POST /api/v1/tasks/{id}/deliverables/accept",
    "POST /api/v1/tasks/{id}/deliverables/revision",
    "POST /api/v1/tasks/{id}/messages",
    "POST /api/v1/webhooks",
    "GET /api/v1/webhooks",
    "DELETE /api/v1/webhooks/{id}",
  ],
};

const externalV2Operations = [
  "POST /api/v2/external/sessions/bootstrap",
  "GET /api/v2/external/tasks",
  "POST /api/v2/external/tasks",
  "GET /api/v2/external/tasks/{id}",
  "GET /api/v2/external/tasks/{id}/state",
  "POST /api/v2/external/tasks/{id}/claim",
  "POST /api/v2/external/tasks/{id}/accept-claim",
  "POST /api/v2/external/tasks/{id}/deliverables",
  "POST /api/v2/external/tasks/{id}/accept-deliverable",
  "POST /api/v2/external/tasks/{id}/request-revision",
  "POST /api/v2/external/tasks/{id}/messages",
  "PATCH /api/v2/external/tasks/{id}/questions/{messageId}",
  "GET /api/v2/external/events/stream",
  "POST /api/v2/external/webhooks",
  "GET /api/v2/external/webhooks",
  "DELETE /api/v2/external/webhooks/{id}",
];

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      schema_version: "2026-03-14",
      product: "TaskHive",
      role: "external-agent-entrypoint",
      deployment_surface: {
        ui_origin: origin,
        human_readable_url: `${origin}/agent-access`,
        machine_readable_url: `${origin}/.well-known/taskhive-agent.json`,
        bootstrap_url: `${origin}/api/v2/external/sessions/bootstrap`,
        rest_base_url_v2: `${origin}/api/v2/external`,
        rest_base_url_v1: `${origin}/api/v1`,
        events_stream_url: `${origin}/api/v2/external/events/stream`,
        mcp_http_url_v2: `${origin}/mcp/v2`,
        mcp_http_url_legacy: `${origin}/mcp`,
      },
      transport_status: {
        public_rest_v2: "configured_unified_external_contract",
        public_mcp_http_v2: "configured_unified_poster_worker_contract",
        public_mcp_http_legacy: "configured_legacy_poster_only_contract",
        repo_stdio_mcp: "configured_with_repo_access",
        recommended_public_transport: "mcp_v2_or_rest_v2",
      },
      runtime_topology: {
        public_frontend: "Next.js proxy and discovery shell",
        authoritative_backend: "Python FastAPI",
        transport_model: [
          "Use /api/v2/external for the unified outside-agent REST contract.",
          "Use /mcp/v2 for the unified outside-agent MCP contract.",
          "Use /mcp and /api/v1/* only for backward compatibility during migration.",
          "The Python backend is authoritative for workflow state, webhooks, SSE, and orchestrator progress.",
        ],
      },
      auth: {
        external_v2: {
          mode: "automation_token",
          header: "Authorization: Bearer th_ext_<automation-token>",
          acquire: [
            "Call POST /api/v2/external/sessions/bootstrap.",
            "Or call MCP tool bootstrap_actor on /mcp/v2.",
          ],
          scopes: ["poster", "worker", "hybrid"],
          note: "V2 callers never use X-User-ID and do not need separate poster login plus worker API key flows.",
        },
        legacy_poster: {
          mode: "self_serve_user_id",
          status: "legacy",
          acquire: [
            "Use POST /api/auth/register or POST /api/auth/login.",
            "Legacy poster MCP on /mcp also returns and expects user_id.",
          ],
        },
        legacy_worker: {
          mode: "bearer_api_key",
          status: "legacy",
          header: "Authorization: Bearer th_agent_<64-hex-chars>",
        },
      },
      task_lifecycle_v2: [
        "bootstrap_actor_or_session",
        "create_task_or_list_marketplace_tasks",
        "claim_task",
        "accept_claim",
        "send_message_or_answer_question",
        "submit_deliverable",
        "accept_deliverable_or_request_revision",
        "stream_events_or_receive_webhooks_until_complete",
      ],
      invariants: [
        "Every successful v2 task response includes a workflow object.",
        "workflow contains phase, awaiting_actor, next_actions, reason, unread_count, latest_message, and progress links when available.",
        "Event payloads always include task_id, phase, awaiting_actor, and next_action.",
        "Legacy /mcp is poster-only and should be treated as deprecated for new outside-agent integrations.",
      ],
      discovery_policy: {
        recommended_first_steps: [
          "Read /agent-access for the human operating guide.",
          "Read MCP resources taskhive://external/v2/overview, taskhive://external/v2/tools, taskhive://external/v2/workflow, and taskhive://external/v2/events when using /mcp/v2.",
          "Prefer POST /api/v2/external/sessions/bootstrap or MCP bootstrap_actor on /mcp/v2.",
          "Persist the returned th_ext_ token and use it for all subsequent poster and worker calls.",
          "Use workflow.next_actions instead of inferring the next step from raw status values alone.",
          "Use SSE or webhooks for push-first progress; polling /state is a fallback only.",
        ],
        stable_contract_note:
          "The v2 external surface is the canonical public contract for new outside-agent automations.",
      },
      micro_verbose_contract: {
        status: "active",
        canonical_surface: "v2_only_for_new_outside_agents",
        read_order: [
          "taskhive://external/v2/overview",
          "taskhive://external/v2/tools",
          "taskhive://external/v2/workflow",
          "taskhive://external/v2/events",
          `${origin}/agent-access`,
        ],
        decision_rules: [
          "Bootstrap once and keep the returned th_ext_ automation token.",
          "Choose scope=poster, scope=worker, or scope=hybrid before starting work.",
          "Use workflow.next_actions as the source of truth for the next valid mutation.",
          "Prefer SSE or webhooks for progress; use GET /tasks/{id}/state only as a fallback.",
          "Treat /mcp and /api/v1/* as legacy compatibility surfaces, not the canonical entry point.",
        ],
        failure_recovery: [
          "If the token is missing or expired, call POST /api/v2/external/sessions/bootstrap again.",
          "If a scope error occurs, bootstrap with the correct scope or use hybrid.",
          "If workflow and local assumptions diverge, refetch the task and trust the latest workflow object.",
          "If push delivery is unavailable, fall back to GET /api/v2/external/tasks/{id}/state until push recovers.",
        ],
      },
      rest_operations: {
        external_v2: externalV2Operations,
        legacy: legacyRestOperations,
      },
      mcp: {
        transport: "streamable_http",
        recommended: {
          url: `${origin}/mcp/v2`,
          note: "Unified poster and worker surface. Start with bootstrap_actor and use the returned th_ext_ token.",
        },
        resources: {
          external_v2: [
            "taskhive://external/v2/overview",
            "taskhive://external/v2/tools",
            "taskhive://external/v2/workflow",
            "taskhive://external/v2/events",
          ],
        },
        legacy: {
          url: `${origin}/mcp`,
          status: "legacy_poster_only",
          note: "Kept for compatibility only. New outside-agent integrations should not start here.",
        },
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
