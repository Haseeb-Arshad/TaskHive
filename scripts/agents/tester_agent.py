"""
TaskHive Tester Agent — Run Tests and Commit Results

Tests the generated codebase:
  1. Auto-installs dependencies (npm/pip)
  2. Runs the test command from the plan
  3. Commits test results (pass or fail)
  4. On failure: loops back to Coder with error context
  5. On success: advances to Deploy

Usage (called by orchestrator, not directly):
    python -m agents.tester_agent --api-key <key> --task-id <id> [--base-url <url>]
"""

import argparse
import json
import os
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
from agents.shell_executor import (
    run_shell_combined,
    run_npm_install,
    run_pip_install,
    run_tests,
    append_build_log,
    log_command,
)

AGENT_NAME = "Tester"
WORKSPACE_DIR = Path("f:/TaskHive/TaskHive/agent_works")


def process_task(client: TaskHiveClient, task_id: int) -> dict:
    try:
        task_dir = WORKSPACE_DIR / f"task_{task_id}"
        state_file = task_dir / ".swarm_state.json"

        if not state_file.exists():
            return {"action": "error", "error": f"State file not found for task {task_id}"}

        with open(state_file, "r") as f:
            state = json.load(f)

        if state.get("status") != "testing":
            return {"action": "no_result", "reason": f"State is {state.get('status')}, not testing."}

        test_command = state.get("test_command")
        append_build_log(task_dir, f"=== Tester Agent starting for task #{task_id} ===")

        if not test_command:
            log_warn("No test command provided by Coder. Assuming success.", AGENT_NAME)
            state["status"] = "deploying"
            with open(state_file, "w") as f:
                json.dump(state, f, indent=2)
            return {"action": "tested", "passed": True}

        # ── Auto-install dependencies ─────────────────────────────────
        if (task_dir / "package.json").exists() and not (task_dir / "node_modules").exists():
            log_think("Installing npm dependencies...", AGENT_NAME)
            rc, out = run_npm_install(task_dir)
            log_command(task_dir, "npm install", rc, out)
            if rc != 0:
                log_warn(f"npm install failed (rc={rc}). Attempting to proceed.", AGENT_NAME)

        if (task_dir / "requirements.txt").exists():
            log_think("Installing pip dependencies...", AGENT_NAME)
            rc, out = run_pip_install(task_dir)
            log_command(task_dir, "pip install -r requirements.txt", rc, out)

        # Fix for Jest multiple config error
        if "npm test" in test_command and (task_dir / "jest.config.js").exists():
            log_think("Detected jest.config.js — forcing use of it.", AGENT_NAME)
            test_command = test_command.replace("npm test", "npm test -- --config jest.config.js")

        # ── Build verification (site projects) ────────────────────────
        # For Next.js / React / Vite projects, verify the production build
        # succeeds before running unit tests — a failing build means nothing else matters.
        pkg = task_dir / "package.json"
        is_site_project = False
        if pkg.exists():
            try:
                import json as _json
                pkg_data = _json.loads(pkg.read_text(encoding="utf-8"))
                scripts = pkg_data.get("scripts", {})
                deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
                is_site_project = any(k in deps for k in ("next", "react", "vite", "@sveltejs/kit"))
                has_build_script = "build" in scripts
            except Exception:
                has_build_script = False

            if is_site_project and has_build_script:
                log_think("Site project detected — running production build first...", AGENT_NAME)
                append_build_log(task_dir, "Running: npm run build")
                build_rc, build_out = run_shell_combined("npm run build", task_dir, timeout=180)
                log_command(task_dir, "npm run build", build_rc, build_out)

                if build_rc != 0:
                    log_warn(f"Build FAILED (rc={build_rc}). Looping back to Coder.", AGENT_NAME)
                    state["status"] = "coding"
                    state["test_errors"] = (
                        f"BUILD FAILED — fix these errors before tests can run:\n"
                        f"{build_out[-2000:] if len(build_out) > 2000 else build_out}"
                    )
                    with open(state_file, "w") as f:
                        import json as _json2; _json2.dump(state, f, indent=2)
                    h = commit_step(task_dir, "build: FAILED — returning to coder")
                    if h:
                        append_commit_log(task_dir, h, "build: failed")
                        push_to_remote(task_dir)
                    return {"action": "tested", "task_id": task_id, "passed": False, "reason": "build_failed"}
                else:
                    log_ok("Production build PASSED.", AGENT_NAME)
                    append_build_log(task_dir, "Build PASSED ✅")

        # ── Run tests ─────────────────────────────────────────────────
        log_think(f"Running tests: `{test_command}` in {task_dir}", AGENT_NAME)
        append_build_log(task_dir, f"Test command: {test_command}")

        rc, output = run_tests(task_dir, test_command, timeout=300)
        log_command(task_dir, test_command, rc, output)

        # ── Save test results ─────────────────────────────────────────
        test_result = {
            "test_command": test_command,
            "exit_code": rc,
            "passed": rc == 0,
            "output_preview": output[:1000],
            "timestamp": time.time(),
            "iteration": state.get("iterations", 1),
        }

        # Append to test history
        results_file = task_dir / ".test_results.json"
        test_history = []
        if results_file.exists():
            try:
                test_history = json.loads(results_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        test_history.append(test_result)
        results_file.write_text(json.dumps(test_history, indent=2), encoding="utf-8")

        # ── Commit test results ───────────────────────────────────────
        if rc == 0:
            log_ok("Tests PASSED! Advancing to deployment.", AGENT_NAME)
            state["status"] = "deploying"
            state["test_errors"] = ""

            h = commit_step(task_dir, "test: all tests passing ✅")
            if h:
                append_commit_log(task_dir, h, "test: all tests passing")
                push_to_remote(task_dir)
                log_ok(f"Test results committed [{h}] and pushed", AGENT_NAME)

        else:
            limited_out = output[-2000:] if len(output) > 2000 else output
            log_warn(f"Tests FAILED (exit code {rc}). Looping back to Coder.", AGENT_NAME)

            state["status"] = "coding"  # Kick back to Coder
            state["test_errors"] = f"Command: {test_command}\nExit code: {rc}\nOutput:\n{limited_out}"

            h = commit_step(task_dir, f"test: failing — exit code {rc}")
            if h:
                append_commit_log(task_dir, h, f"test: failing (rc={rc})")
                push_to_remote(task_dir)
                log_ok(f"Failing test results committed [{h}] and pushed", AGENT_NAME)

        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)

        return {"action": "tested", "task_id": task_id, "passed": (rc == 0)}

    except Exception as e:
        log_err(f"Exception during testing: {e}")
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
