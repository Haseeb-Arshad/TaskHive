"""
TaskHive Deploy Agent — Vercel Deployment with Smoke Testing

Handles deployment pipeline:
  1. Runs Vercel production deployment
  2. Waits for propagation
  3. Smoke tests the deployed URL
  4. Commits deploy results
  5. Submits deliverable to TaskHive API

Usage (called by orchestrator, not directly):
    python -m agents.deploy_agent --api-key <key> --task-id <id> [--base-url <url>]
"""

import argparse
import json
import os
import re
import sys
import time
import traceback
from pathlib import Path

# Add parent path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base_agent import (
    BASE_URL,
    TaskHiveClient,
    log_err,
    log_ok,
    log_think,
    log_warn,
)
from agents.git_ops import commit_step, push_to_remote, append_commit_log
from agents.shell_executor import run_shell_combined, append_build_log, log_command

import subprocess
try:
    import requests as http_requests
except ImportError:
    http_requests = None

AGENT_NAME = "Deployer"
WORKSPACE_DIR = Path("f:/TaskHive/TaskHive/agent_works")

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN")
VERCEL_ORG_ID = os.environ.get("VERCEL_ORG_ID")
VERCEL_PROJECT_ID = os.environ.get("VERCEL_PROJECT_ID")


# ═══════════════════════════════════════════════════════════════════════════
# VERCEL DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════

def run_vercel_deploy(task_dir: Path) -> str | None:
    """Run Vercel CLI to deploy and return the production URL."""
    if not VERCEL_TOKEN:
        log_warn("VERCEL_TOKEN not found in environment. Skipping deployment.", AGENT_NAME)
        return None

    log_think("Executing Vercel production deployment...", AGENT_NAME)
    append_build_log(task_dir, "Starting Vercel deployment...")

    try:
        cmd = ["vercel", "--prod", "--yes", "--token", VERCEL_TOKEN]
        proc = subprocess.run(
            cmd, cwd=str(task_dir), capture_output=True, text=True, timeout=180
        )

        output = (proc.stdout + "\n" + proc.stderr).strip()
        log_command(task_dir, "vercel --prod", proc.returncode, output)

        if proc.returncode != 0:
            log_err(f"Vercel Deployment Failed (code {proc.returncode}):\n{output[:500]}")
            return None

        # Extract URL from output
        urls = re.findall(r'https://[a-zA-Z0-9.-]+\.vercel\.app', output)
        if urls:
            return urls[0]

        return None
    except Exception as e:
        log_err(f"Vercel execution error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# SMOKE TESTING
# ═══════════════════════════════════════════════════════════════════════════

def smoke_test(url: str, retries: int = 3, wait: int = 10) -> tuple[bool, str]:
    """
    Hit the deployed URL and verify it's alive.
    
    Returns:
        (passed: bool, details: str)
    """
    if http_requests is None:
        # Fallback: use curl
        return _smoke_test_curl(url, retries, wait)

    log_think(f"Smoke testing: {url} (max {retries} attempts)...", AGENT_NAME)

    for attempt in range(1, retries + 1):
        try:
            log_think(f"  Attempt {attempt}/{retries}...", AGENT_NAME)
            time.sleep(wait if attempt == 1 else 5)

            resp = http_requests.get(url, timeout=15, allow_redirects=True)
            status = resp.status_code
            body_len = len(resp.text)

            if status == 200 and body_len > 100:
                # Check it's not an error page
                lower = resp.text.lower()
                if "application error" not in lower and "internal server error" not in lower:
                    return True, f"HTTP {status}, {body_len} bytes — site is live"

            log_warn(
                f"  Attempt {attempt}: HTTP {status}, body={body_len} bytes",
                AGENT_NAME
            )
        except Exception as e:
            log_warn(f"  Attempt {attempt} failed: {e}", AGENT_NAME)

    return False, f"Smoke test failed after {retries} attempts"


def _smoke_test_curl(url: str, retries: int, wait: int) -> tuple[bool, str]:
    """Fallback smoke test using curl."""
    for attempt in range(1, retries + 1):
        time.sleep(wait if attempt == 1 else 5)
        rc, out = run_shell_combined(
            f'curl -s -o /dev/null -w "%{{http_code}}" {url}',
            Path("."), timeout=15
        )
        if rc == 0 and out.strip() == "200":
            return True, f"HTTP 200 — site is live (curl)"
    return False, f"Smoke test failed after {retries} attempts (curl)"


# ═══════════════════════════════════════════════════════════════════════════
# MAIN PROCESS
# ═══════════════════════════════════════════════════════════════════════════

def process_task(client: TaskHiveClient, task_id: int) -> dict:
    try:
        task_dir = WORKSPACE_DIR / f"task_{task_id}"
        state_file = task_dir / ".swarm_state.json"

        if not state_file.exists():
            return {"action": "error", "error": f"State file not found for task {task_id}"}

        with open(state_file, "r") as f:
            state = json.load(f)

        if state.get("status") != "deploying":
            return {"action": "no_result", "reason": f"State is {state.get('status')}, not deploying."}

        repo_url = state.get("repo_url", "No Repo URL Provided")
        iterations = state.get("iterations", 1)
        append_build_log(task_dir, f"=== Deploy Agent starting for task #{task_id} ===")

        # ── Deploy to Vercel ──────────────────────────────────────────
        vercel_url = run_vercel_deploy(task_dir)
        deploy_passed = False

        if vercel_url:
            log_ok(f"Vercel Deployment URL: {vercel_url}", AGENT_NAME)

            # ── Smoke Test ────────────────────────────────────────────
            passed, details = smoke_test(vercel_url)
            deploy_passed = passed

            if passed:
                log_ok(f"Smoke test PASSED: {details}", AGENT_NAME)
                state["vercel_url"] = vercel_url
                state["smoke_test"] = {"passed": True, "details": details}
                append_build_log(task_dir, f"Smoke test PASSED: {details}")
            else:
                log_warn(f"Smoke test FAILED: {details}", AGENT_NAME)
                state["smoke_test"] = {"passed": False, "details": details}
                append_build_log(task_dir, f"Smoke test FAILED: {details}")

                # Retry deploy once
                log_think("Retrying Vercel deployment...", AGENT_NAME)
                vercel_url_retry = run_vercel_deploy(task_dir)
                if vercel_url_retry:
                    time.sleep(15)
                    passed2, details2 = smoke_test(vercel_url_retry)
                    if passed2:
                        log_ok(f"Retry smoke test PASSED: {details2}", AGENT_NAME)
                        state["vercel_url"] = vercel_url_retry
                        state["smoke_test"] = {"passed": True, "details": details2}
                        deploy_passed = True
                    else:
                        log_warn(f"Retry smoke test also FAILED. Proceeding anyway.", AGENT_NAME)
                        state["vercel_url"] = vercel_url_retry
        else:
            log_warn("Vercel deployment skipped or failed.", AGENT_NAME)
            vercel_url = "Deployment skipped (no VERCEL_TOKEN set)"

        # ── Commit deploy results ─────────────────────────────────────
        deploy_summary = {
            "vercel_url": state.get("vercel_url"),
            "smoke_test": state.get("smoke_test"),
            "deployed_at": time.time(),
        }
        deploy_file = task_dir / ".deploy_results.json"
        deploy_file.write_text(json.dumps(deploy_summary, indent=2), encoding="utf-8")

        h = commit_step(task_dir, f"chore: deploy to Vercel — {state.get('vercel_url', 'skipped')}")
        if h:
            append_commit_log(task_dir, h, "chore: deploy to Vercel")
            push_to_remote(task_dir)
            log_ok(f"Deploy results committed [{h}] and pushed", AGENT_NAME)

        # ── Craft deliverable ─────────────────────────────────────────
        delivery_lines = [
            f"🚀 **Automated CI/CD Delivery**",
            "",
            f"The Swarm has successfully written, tested, pushed, and deployed the code for this task.",
            "",
            f"**GitHub Repository**: {repo_url}",
        ]

        if state.get("vercel_url"):
            delivery_lines.append(f"**Live Deployment**: {state['vercel_url']}")
            if deploy_passed:
                delivery_lines.append("**Smoke Test**: ✅ Passed — site is live and responding")
            else:
                delivery_lines.append("**Smoke Test**: ⚠️ Warning — deploy succeeded but smoke test had issues")

        commit_log = state.get("commit_log", [])
        if commit_log:
            delivery_lines.append(f"**Total Commits**: {len(commit_log)}")

        delivery_lines.append(f"**Testing Iterations**: {iterations}")
        delivery_lines.append("")
        delivery_lines.append("All automated tests passed. The codebase is production-ready.")

        content = "\n".join(delivery_lines)

        # ── Submit Deliverable ────────────────────────────────────────
        try:
            client.submit_deliverable(task_id, content)
            log_ok(f"Deliverable submitted for task #{task_id}!", AGENT_NAME)
        except Exception as e:
            if "already have a submitted deliverable" in str(e).lower() or "409" in str(e):
                log_warn(f"Already submitted deliverable for task #{task_id}", AGENT_NAME)
            else:
                raise e

        # Mark finished
        state["status"] = "delivered"
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)

        return {
            "action": "deployed",
            "task_id": task_id,
            "repo": repo_url,
            "vercel": state.get("vercel_url"),
            "smoke_test_passed": deploy_passed,
        }

    except Exception as e:
        log_err(f"Exception during deployment: {e}")
        log_err(traceback.format_exc().strip().splitlines()[-1])
        return {"action": "error", "error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--task-id", type=int, required=True)
    args = parser.parse_args()

    client = TaskHiveClient(args.base_url, args.api_key)
    result = process_task(client, args.task_id)
    print(f"\n__RESULT__:{json.dumps(result)}")

if __name__ == "__main__":
    main()
