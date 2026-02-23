#!/usr/bin/env python3
"""
TaskHive Scout Agent — Browse, Evaluate, and Claim Tasks

One-shot agent that:
  1. Browses open tasks
  2. Evaluates them via LLM
  3. Posts constructive feedback on vague tasks
  4. Claims the best matching task

Usage (called by orchestrator, not directly):
    python -m agents.scout_agent --api-key <key> [--base-url <url>]
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from datetime import datetime, timezone

# Add parent to path so we can import base_agent
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))

from agents.base_agent import (
    BASE_URL,
    TaskHiveClient,
    iso_to_datetime,
    llm_call,
    llm_json,
    log_act,
    log_err,
    log_ok,
    log_think,
    log_wait,
    log_warn,
)

AGENT_NAME = "Scout"
MAX_REMARKS_PER_TASK = 2


# ═══════════════════════════════════════════════════════════════════════════
# SCOUT BRAIN
# ═══════════════════════════════════════════════════════════════════════════

def evaluate_task(task: dict, capabilities: list[str]) -> dict:
    """THINK: Should I claim this task? How much to bid?"""
    remarks = task.get("agent_remarks", [])
    remarks_history = ""
    if remarks:
        remarks_history = "\nPrevious agent feedback on this task:\n"
        for r in remarks:
            remarks_history += f"- {r.get('agent_name')}: {r.get('remark')}\n"

    return llm_json(
        "You are an AI freelancer agent on TaskHive. You evaluate tasks to decide which ones to claim. "
        f"Your capabilities: {', '.join(capabilities)}. "
        "Be selective but pragmatic — claim tasks you can deliver quality work for. "
        "If a task has a clear title, reasonable description, and any stated requirements, that is usually ENOUGH to claim. "
        "Do NOT reject tasks for being 'too simple' or 'too small' — micro-tasks and simple algorithm scripts are valuable for rapid iteration and testing. "
        "Only flag a task as vague if the description is truly insufficient to start work. "
        "Do NOT demand excessive specifics like exact deadlines, framework choices, or line-item acceptance criteria — "
        "those are implementation details you can decide yourself. "
        "If a task IS genuinely vague (e.g., one-sentence description with no context), suggest improvements.",

        f"Evaluate this task:\n"
        f"  Title: {task.get('title', 'N/A')}\n"
        f"  Description: {(task.get('description') or 'N/A')[:500]}\n"
        f"  Budget: {task.get('budget_credits', 0)} credits\n"
        f"  Requirements: {(task.get('requirements') or 'N/A')[:300]}\n"
        f"{remarks_history}\n"
        f"  Category: {task.get('category', {}).get('name', 'General') if isinstance(task.get('category'), dict) else 'General'}\n\n"
        "Should I claim this? Respond with JSON:\n"
        '{"should_claim": true/false, "confidence": "high/medium/low", '
        '"proposed_credits": <number <= budget>, '
        '"is_vague": true/false, '
        '"feedback": "concise, friendly advice to the user on why this task is hard to claim or how to improve it", '
        '"reason": "internal reason why this is a good/bad fit", '
        '"approach": "brief plan if claiming"}',
        complexity="routine"
    )


def generate_claim_message(task: dict, approach: str, capabilities: list[str]) -> str:
    """Generate a compelling claim message."""
    return llm_call(
        "Write a brief, professional claim message for a freelance task. "
        "1-3 sentences explaining why you're the right agent for this task.",
        f"Task: {task.get('title')}\nMy approach: {approach}\n"
        f"My skills: {', '.join(capabilities)}\n\n"
        "Write ONLY the claim message, nothing else.",
        max_tokens=200,
        provider="trinity"
    ).strip()


# ═══════════════════════════════════════════════════════════════════════════
# SCOUT MAIN
# ═══════════════════════════════════════════════════════════════════════════

def run_scout(
    client: TaskHiveClient,
    capabilities: list[str],
    attempted_tasks: dict[int, datetime] | None = None,
    claimed_task_ids: set[int] | None = None,
) -> dict:
    """
    Run one scouting cycle. Returns a result dict with:
      - action: "claimed" | "feedback" | "no_tasks" | "no_match"
      - task_id: (if claimed)
      - claim_id: (if claimed)
    """
    if attempted_tasks is None:
        attempted_tasks = {}
    if claimed_task_ids is None:
        claimed_task_ids = set()

    log_think("Browsing for open tasks...", AGENT_NAME)
    open_tasks = client.browse_tasks("open", limit=20)

    if not open_tasks:
        log_wait("No open tasks available", AGENT_NAME)
        return {"action": "no_tasks"}

    log_think(f"Found {len(open_tasks)} open task(s)", AGENT_NAME)

    best_task = None
    best_evaluation = None

    for task_summary in open_tasks:
        task_id = task_summary.get("id")
        if not task_id or task_id in claimed_task_ids:
            continue

        # Skip tasks we've seen recently (unless updated)
        current_updated_at = iso_to_datetime(task_summary.get("updated_at"))
        last_seen_at = attempted_tasks.get(task_id)
        if last_seen_at and current_updated_at and last_seen_at >= current_updated_at:
            continue

        # Get full task details
        try:
            detail = client.get_task(task_id)
        except Exception as e:
            log_warn(f"Failed to fetch task #{task_id}: {e}", AGENT_NAME)
            continue
        if not detail:
            continue

        # Update "last seen" mark
        task_updated = iso_to_datetime(detail.get("updated_at"))
        attempted_tasks[task_id] = task_updated or datetime.now(timezone.utc)

        # Check our remark history on this task
        remarks = detail.get("agent_remarks", [])
        my_remarks = [r for r in remarks if r.get("agent_id") == client.agent_id]

        if my_remarks:
            latest_remark = max(my_remarks, key=lambda r: r.get("timestamp", ""))
            remark_time = iso_to_datetime(latest_remark.get("timestamp"))
            if task_updated and remark_time and remark_time >= task_updated:
                if len(my_remarks) >= MAX_REMARKS_PER_TASK:
                    log_think(f"Task #{task_id}: {len(my_remarks)} remarks posted, task unchanged, skipping", AGENT_NAME)
                continue
            else:
                log_think(f"Task #{task_id} was updated since my last feedback. Re-evaluating...", AGENT_NAME)

        log_think(f"Evaluating: \"{detail.get('title', '')[:50]}\" (budget={detail.get('budget_credits')})", AGENT_NAME)

        try:
            evaluation = evaluate_task(detail, capabilities)
        except Exception as e:
            log_warn(f"LLM evaluation failed: {e}", AGENT_NAME)
            continue

        if evaluation.get("should_claim") and evaluation.get("confidence") in ("high", "medium"):
            if best_task is None or evaluation.get("proposed_credits", 0) > (best_evaluation or {}).get("proposed_credits", 0):
                best_task = detail
                best_evaluation = evaluation
                log_think(f"  -> Good fit! confidence={evaluation.get('confidence')}, bid={evaluation.get('proposed_credits')}", AGENT_NAME)
        else:
            reason = evaluation.get("reason", "not a good fit")
            feedback = evaluation.get("feedback", reason).strip().strip("\"'")
            is_vague = evaluation.get("is_vague", False)

            log_think(f"  -> Skipping: {reason[:80]}", AGENT_NAME)

            # Post constructive feedback
            if len(my_remarks) < MAX_REMARKS_PER_TASK:
                try:
                    remark_msg = feedback if is_vague else f"I'm passing on this task because: {feedback}"
                    client.post_remark(task_id, remark_msg)
                    log_ok(f"Remark posted to #{task_id}", AGENT_NAME)
                except Exception as e:
                    log_warn(f"Failed to send remark to #{task_id}: {e}", AGENT_NAME)

            attempted_tasks[task_id] = datetime.now(timezone.utc)

    if not best_task:
        log_wait("No suitable tasks found this cycle", AGENT_NAME)
        return {"action": "no_match"}

    # Claim the best task
    task_id = best_task["id"]
    budget = best_task.get("budget_credits", 50)
    proposed = min(best_evaluation.get("proposed_credits", budget), budget)
    proposed = max(proposed, 10)

    approach = best_evaluation.get("approach", "I will deliver high-quality work.")
    try:
        message = generate_claim_message(best_task, approach, capabilities)
    except Exception:
        message = f"I can deliver this task. My approach: {approach[:200]}"

    log_act(f"Claiming task #{task_id} for {proposed} credits...", AGENT_NAME)
    claim_resp = client.claim_task(task_id, proposed, message)

    if not claim_resp.get("ok"):
        err = (claim_resp.get("error") or {})
        log_warn(f"Claim rejected: {err.get('code', 'unknown')} — {err.get('message', '')[:100]}", AGENT_NAME)
        return {"action": "claim_rejected", "task_id": task_id, "error": err}

    claim_id = claim_resp["data"]["id"]
    log_ok(f"Claim #{claim_id} submitted for task #{task_id}! Waiting for poster to accept...", AGENT_NAME)

    return {
        "action": "claimed",
        "task_id": task_id,
        "claim_id": claim_id,
        "proposed_credits": proposed,
    }


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="TaskHive Scout Agent")
    parser.add_argument("--api-key", type=str, required=True, help="Agent API key")
    parser.add_argument("--base-url", type=str, default=BASE_URL, help="TaskHive API base URL")
    parser.add_argument("--capabilities", type=str, default="python,javascript,sql",
                       help="Comma-separated capabilities")
    args = parser.parse_args()

    capabilities = [c.strip() for c in args.capabilities.split(",")]
    client = TaskHiveClient(args.base_url, args.api_key)

    profile = client.get_profile()
    if not profile:
        log_err("Failed to authenticate with API key", AGENT_NAME)
        sys.exit(1)

    log_ok(f"Scout Agent active as: {client.agent_name} (ID: {client.agent_id})", AGENT_NAME)

    # Load existing claims to avoid double-claiming
    claimed_ids = set()
    try:
        claims = client.get_my_claims()
        for claim in claims:
            tid = claim.get("task_id") or (claim.get("task") or {}).get("id")
            if tid and claim.get("status") in ("pending", "accepted"):
                claimed_ids.add(tid)
    except Exception:
        pass

    result = run_scout(client, capabilities, claimed_task_ids=claimed_ids)
    # Output result as JSON for the orchestrator to read
    print(f"\n__RESULT__:{json.dumps(result)}", flush=True)


if __name__ == "__main__":
    main()
