/**
 * TaskHive Demo Bot
 *
 * Demonstrates the full agent lifecycle end-to-end:
 *   Register → Create Task → Browse → Claim → Accept → Deliver → Accept → Credits
 *
 * Run with: npm run demo-bot
 * Or: npx tsx scripts/demo-bot.ts [--base-url http://localhost:3000]
 */

import "dotenv/config";

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf("--base-url");
const BASE_URL =
  urlFlagIdx !== -1
    ? args[urlFlagIdx + 1]
    : process.env.DEMO_BOT_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

const TIMESTAMP = Date.now();
const POSTER_EMAIL = `demo-poster-${TIMESTAMP}@taskhive-demo.local`;
const POSTER_PASSWORD = "DemoPassword123!";
const POSTER_NAME = "Demo Poster";

const FREELANCER_EMAIL = `demo-freelancer-${TIMESTAMP}@taskhive-demo.local`;
const FREELANCER_PASSWORD = "DemoPassword456!";
const FREELANCER_NAME = "Demo Freelancer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const log = {
  step: (n: number, msg: string) => console.log(`\n\x1b[36m[Step ${n}]\x1b[0m ${msg}`),
  ok: (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  info: (msg: string) => console.log(`  \x1b[90m→\x1b[0m ${msg}`),
  fail: (msg: string) => { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); process.exit(1); },
  json: (label: string, data: unknown) =>
    console.log(`  \x1b[90m${label}:\x1b[0m`, JSON.stringify(data, null, 2).split("\n").map(l => "    " + l).join("\n")),
};

async function api(
  method: string,
  path: string,
  body?: unknown,
  authKey?: string
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authKey) {
    headers["Authorization"] = `Bearer ${authKey}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assertOk(res: { status: number; data: unknown }, label: string): unknown {
  const d = res.data as Record<string, unknown>;
  if (!d?.ok) {
    log.fail(`${label} failed (HTTP ${res.status}): ${JSON.stringify(d?.error || d)}`);
  }
  return (d as Record<string, unknown>).data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\x1b[1m\x1b[35m╔════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[1m\x1b[35m║       TaskHive Demo Bot                ║\x1b[0m");
  console.log("\x1b[1m\x1b[35m╚════════════════════════════════════════╝\x1b[0m");
  console.log(`  Base URL: \x1b[33m${BASE_URL}\x1b[0m`);

  // ── Step 1: Register Poster ───────────────────────────────────────────────
  log.step(1, "Register poster user");
  const posterReg = await api("POST", "/api/auth/register", {
    email: POSTER_EMAIL,
    password: POSTER_PASSWORD,
    name: POSTER_NAME,
  });
  if (posterReg.status !== 201) {
    log.fail(`Poster registration failed: ${JSON.stringify(posterReg.data)}`);
  }
  const poster = posterReg.data as { id: number; email: string; name: string };
  log.ok(`Poster registered: ${poster.name} (ID: ${poster.id})`);

  // ── Step 2: Register Poster's Agent ──────────────────────────────────────
  log.step(2, "Register poster's agent (needed to accept claims via API)");
  const posterAgentRes = await api("POST", "/api/v1/agents", {
    email: POSTER_EMAIL,
    password: POSTER_PASSWORD,
    name: "PosterBot",
    description: "Automated poster agent for task management",
    capabilities: ["task-management"],
  });
  if (posterAgentRes.status !== 201) {
    log.fail(`Poster agent registration failed: ${JSON.stringify(posterAgentRes.data)}`);
  }
  const posterAgent = (posterAgentRes.data as Record<string, unknown>).data as {
    agent_id: number;
    api_key: string;
    api_key_prefix: string;
    operator_id: number;
  };
  log.ok(`Poster agent created (ID: ${posterAgent.agent_id}, prefix: ${posterAgent.api_key_prefix})`);
  log.info("API key stored (shown once)");

  // ── Step 3: Register Freelancer ──────────────────────────────────────────
  log.step(3, "Register freelancer user");
  const freelancerReg = await api("POST", "/api/auth/register", {
    email: FREELANCER_EMAIL,
    password: FREELANCER_PASSWORD,
    name: FREELANCER_NAME,
  });
  if (freelancerReg.status !== 201) {
    log.fail(`Freelancer registration failed: ${JSON.stringify(freelancerReg.data)}`);
  }
  const freelancer = freelancerReg.data as { id: number; email: string; name: string };
  log.ok(`Freelancer registered: ${freelancer.name} (ID: ${freelancer.id})`);

  // ── Step 4: Register Freelancer's Agent ──────────────────────────────────
  log.step(4, "Register freelancer's agent");
  const freelancerAgentRes = await api("POST", "/api/v1/agents", {
    email: FREELANCER_EMAIL,
    password: FREELANCER_PASSWORD,
    name: "FreelancerBot",
    description: "AI-powered freelancer that browses, claims, and delivers tasks",
    capabilities: ["coding", "writing", "research"],
  });
  if (freelancerAgentRes.status !== 201) {
    log.fail(`Freelancer agent registration failed: ${JSON.stringify(freelancerAgentRes.data)}`);
  }
  const freelancerAgent = (freelancerAgentRes.data as Record<string, unknown>).data as {
    agent_id: number;
    api_key: string;
    api_key_prefix: string;
    operator_id: number;
  };
  log.ok(`Freelancer agent created (ID: ${freelancerAgent.agent_id})`);

  // ── Step 5: Verify Agent Auth ─────────────────────────────────────────────
  log.step(5, "Verify agent authentication");
  const meRes = await api("GET", "/api/v1/agents/me", undefined, freelancerAgent.api_key);
  const me = assertOk(meRes, "GET /agents/me") as Record<string, unknown>;
  log.ok(`FreelancerBot authenticated: ${me.name} (reputation: ${me.reputation_score})`);

  // ── Step 6: Poster Creates a Task ────────────────────────────────────────
  log.step(6, "Poster agent creates a task");
  const taskRes = await api(
    "POST",
    "/api/v1/tasks",
    {
      title: "Write a Python function to parse JSON config files",
      description:
        "Need a Python utility function that reads a JSON config file, validates required keys, and returns a typed dictionary. Should handle missing files and invalid JSON gracefully.",
      requirements:
        "- Python 3.10+\n- Type hints required\n- Handle FileNotFoundError and json.JSONDecodeError\n- Return TypedDict with keys: host, port, debug\n- Include docstring",
      budget_credits: 150,
      max_revisions: 2,
    },
    posterAgent.api_key
  );
  const task = assertOk(taskRes, "POST /tasks") as Record<string, unknown>;
  const taskId = task.id as number;
  log.ok(`Task created: "${task.title}" (ID: ${taskId}, budget: ${task.budget_credits} credits)`);

  // ── Step 7: Freelancer Browses Tasks ─────────────────────────────────────
  log.step(7, "Freelancer agent browses open tasks");
  const browseRes = await api(
    "GET",
    "/api/v1/tasks?status=open&sort=newest&limit=5",
    undefined,
    freelancerAgent.api_key
  );
  const browseData = assertOk(browseRes, "GET /tasks") as unknown[];
  log.ok(`Found ${browseData.length} open task(s)`);
  log.info(`First task: "${(browseData[0] as Record<string, unknown>).title}"`);

  // ── Step 8: Get Task Details ──────────────────────────────────────────────
  log.step(8, "Freelancer agent reads full task details");
  const detailRes = await api(
    "GET",
    `/api/v1/tasks/${taskId}`,
    undefined,
    freelancerAgent.api_key
  );
  const detail = assertOk(detailRes, `GET /tasks/${taskId}`) as Record<string, unknown>;
  log.ok(`Task details fetched: budget=${detail.budget_credits}, max_revisions=${detail.max_revisions}`);

  // ── Step 9: Claim the Task ────────────────────────────────────────────────
  log.step(9, "Freelancer agent claims the task");
  const claimRes = await api(
    "POST",
    `/api/v1/tasks/${taskId}/claims`,
    {
      proposed_credits: 140,
      message:
        "I specialize in Python utility functions. I'll deliver a fully typed, well-documented solution with comprehensive error handling within 1 hour.",
    },
    freelancerAgent.api_key
  );
  const claim = assertOk(claimRes, `POST /tasks/${taskId}/claims`) as Record<string, unknown>;
  const claimId = claim.id as number;
  log.ok(`Claim submitted (ID: ${claimId}, proposed: ${claim.proposed_credits} credits, status: ${claim.status})`);

  // ── Step 10: Poster Accepts the Claim ────────────────────────────────────
  log.step(10, "Poster agent accepts the claim");
  const acceptClaimRes = await api(
    "POST",
    `/api/v1/tasks/${taskId}/claims/accept`,
    { claim_id: claimId },
    posterAgent.api_key
  );
  const acceptClaim = assertOk(acceptClaimRes, `POST /tasks/${taskId}/claims/accept`) as Record<string, unknown>;
  log.ok(`Claim accepted! Task status: ${acceptClaim.status}`);
  log.info("All other pending claims auto-rejected");

  // ── Step 11: Submit Deliverable ───────────────────────────────────────────
  log.step(11, "Freelancer agent submits deliverable");
  const deliverableContent = `## Python Config File Parser

### Implementation

\`\`\`python
from __future__ import annotations
import json
from pathlib import Path
from typing import TypedDict


class AppConfig(TypedDict):
    host: str
    port: int
    debug: bool


REQUIRED_KEYS: frozenset[str] = frozenset({"host", "port", "debug"})


def parse_config(path: str | Path) -> AppConfig:
    """
    Read and validate a JSON configuration file.

    Args:
        path: Path to the JSON config file.

    Returns:
        Validated AppConfig TypedDict with keys: host, port, debug.

    Raises:
        FileNotFoundError: If the config file does not exist.
        json.JSONDecodeError: If the file contains invalid JSON.
        ValueError: If required keys are missing from the config.
    """
    config_path = Path(path)

    try:
        with config_path.open("r", encoding="utf-8") as f:
            data: dict = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Config file not found: {config_path}")
    except json.JSONDecodeError as exc:
        raise json.JSONDecodeError(
            f"Invalid JSON in config file {config_path}: {exc.msg}",
            exc.doc,
            exc.pos,
        )

    missing = REQUIRED_KEYS - data.keys()
    if missing:
        raise ValueError(f"Missing required config keys: {', '.join(sorted(missing))}")

    return AppConfig(
        host=str(data["host"]),
        port=int(data["port"]),
        debug=bool(data["debug"]),
    )
\`\`\`

### Usage Example

\`\`\`python
try:
    config = parse_config("app.json")
    print(f"Running on {config['host']}:{config['port']}")
except FileNotFoundError as e:
    print(f"Error: {e}")
except json.JSONDecodeError as e:
    print(f"Config parse error: {e}")
except ValueError as e:
    print(f"Config validation error: {e}")
\`\`\`

### Requirements Met
- ✅ Python 3.10+ (uses \`str | Path\` union type)
- ✅ Type hints throughout
- ✅ Handles \`FileNotFoundError\`
- ✅ Handles \`json.JSONDecodeError\`
- ✅ Returns TypedDict with host, port, debug keys
- ✅ Includes comprehensive docstring
`;

  const deliverRes = await api(
    "POST",
    `/api/v1/tasks/${taskId}/deliverables`,
    { content: deliverableContent },
    freelancerAgent.api_key
  );
  const deliverable = assertOk(deliverRes, `POST /tasks/${taskId}/deliverables`) as Record<string, unknown>;
  const deliverableId = deliverable.id as number;
  log.ok(`Deliverable submitted (ID: ${deliverableId}, revision: ${deliverable.revision_number})`);

  // ── Step 12: Poster Accepts Deliverable ──────────────────────────────────
  log.step(12, "Poster agent accepts the deliverable");
  const acceptDelRes = await api(
    "POST",
    `/api/v1/tasks/${taskId}/deliverables/accept`,
    { deliverable_id: deliverableId },
    posterAgent.api_key
  );
  const acceptDel = assertOk(acceptDelRes, `POST /tasks/${taskId}/deliverables/accept`) as Record<string, unknown>;
  log.ok(`Deliverable accepted! Task completed.`);
  log.info(`Credits paid: ${acceptDel.credits_paid}, Platform fee: ${acceptDel.platform_fee}`);

  // ── Step 13: Verify Credits ───────────────────────────────────────────────
  log.step(13, "Freelancer verifies credit balance");
  const creditsRes = await api(
    "GET",
    "/api/v1/agents/me/credits",
    undefined,
    freelancerAgent.api_key
  );
  const credits = assertOk(creditsRes, "GET /agents/me/credits") as Record<string, unknown>;
  log.ok(`Credit balance: ${credits.credit_balance} credits`);
  const txList = credits.recent_transactions as unknown[];
  if (txList?.length) {
    const lastTx = txList[0] as Record<string, unknown>;
    log.info(`Last transaction: +${lastTx.amount} (${lastTx.type}) — balance_after: ${lastTx.balance_after}`);
  }

  // ── Step 14: Check Task Status ────────────────────────────────────────────
  log.step(14, "Verify final task status");
  const finalRes = await api(
    "GET",
    `/api/v1/tasks/${taskId}`,
    undefined,
    freelancerAgent.api_key
  );
  const final = assertOk(finalRes, `GET /tasks/${taskId}`) as Record<string, unknown>;
  log.ok(`Task ${taskId} final status: \x1b[32m${final.status}\x1b[0m`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n\x1b[1m\x1b[35m╔════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[1m\x1b[35m║        Demo Complete! ✅               ║\x1b[0m");
  console.log("\x1b[1m\x1b[35m╚════════════════════════════════════════╝\x1b[0m");
  console.log(`
  Full agent lifecycle demonstrated:
    1. Registered poster + poster's agent
    2. Registered freelancer + freelancer's agent
    3. Poster created task (budget: 150 credits)
    4. Freelancer browsed open tasks
    5. Freelancer claimed task (proposed: 140 credits)
    6. Poster accepted claim
    7. Freelancer submitted deliverable (Python config parser)
    8. Poster accepted deliverable
    9. Credits flowed: ${acceptDel.credits_paid} to freelancer operator
   10. Task completed ✅

  Poster: ${POSTER_EMAIL}
  Freelancer: ${FREELANCER_EMAIL}
  Task ID: ${taskId}
`);
}

main().catch((err) => {
  console.error("\x1b[31mUnexpected error:\x1b[0m", err);
  process.exit(1);
});
