"""
TaskHive Coder Agent — Shell-Based, Step-by-Step Code Generator

Multi-step agent that:
  1. Creates a GitHub repo FIRST
  2. Plans the codebase as a series of steps
  3. Executes each step individually
  4. Commits after every step with descriptive messages
  5. Pushes to GitHub incrementally

Usage (called by orchestrator, not directly):
    python -m agents.coder_agent --api-key <key> --task-id <id> [--base-url <url>]
"""

import argparse
import json
import os
import sys
import traceback
from pathlib import Path

# Add parent path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base_agent import (
    BASE_URL,
    TaskHiveClient,
    llm_json,
    smart_llm_call,
    kimi_enhance_prompt,
    log_err,
    log_ok,
    log_think,
    log_warn,
)
from agents.git_ops import (
    init_repo,
    create_github_repo,
    commit_step,
    push_to_remote,
    should_push,
    append_commit_log,
    get_repo_url,
)
from agents.shell_executor import (
    run_shell_combined,
    run_npm_install,
    run_npx_create,
    append_build_log,
    log_command,
)

AGENT_NAME = "Coder"
WORKSPACE_DIR = Path("f:/TaskHive/TaskHive/agent_works")


# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: PLAN — Break the task into implementation steps
# ═══════════════════════════════════════════════════════════════════════════

def plan_implementation(title: str, desc: str, reqs: str, past_errors: str = "") -> list[dict]:
    """
    Ask the LLM to break the task into implementation steps.
    Each step has a description and list of files to generate.
    """
    error_context = ""
    if past_errors:
        error_context = (
            f"\n\nPREVIOUS ATTEMPT FAILED WITH THIS ERROR:\n{past_errors}\n"
            "You must account for this in your plan and fix the issue.\n"
        )

    system = (
        "You are a Senior Software Architect planning an implementation. "
        "Break the task into 3-6 ordered implementation steps. "
        "Each step should be a logical unit of work (e.g. scaffold, config, "
        "core logic, API routes, UI components, tests). "
        "YOU MUST OUTPUT ONLY VALID JSON. NO CONVERSATIONAL TEXT."
    )

    user = (
        f"Plan the implementation for this task:\n"
        f"Title: {title}\n"
        f"Description: {desc}\n"
        f"Requirements: {reqs}\n"
        f"{error_context}\n"
        "Return a JSON object with:\n"
        '{\n'
        '  "project_type": "nextjs" | "react" | "node" | "python" | "static",\n'
        '  "scaffold_command": "npx create-next-app@latest ./ --typescript --yes" or null,\n'
        '  "steps": [\n'
        '    {\n'
        '      "step_number": 1,\n'
        '      "description": "Set up project configuration",\n'
        '      "commit_message": "chore: add project configuration",\n'
        '      "files": [\n'
        '        {"path": "tsconfig.json", "description": "TypeScript config"}\n'
        '      ]\n'
        '    }\n'
        '  ],\n'
        '  "test_command": "npm test"\n'
        '}\n'
    )

    result = llm_json(system, user, max_tokens=2048, complexity="routine")
    return result


def generate_step_code(
    step: dict,
    title: str,
    desc: str,
    reqs: str,
    blueprint: str,
    existing_files: list[str],
    skill_contents: list[str],
) -> list[dict]:
    """
    Generate code for a single implementation step.
    Returns a list of {path, content} dicts.
    """
    files_desc = "\n".join(
        f"  - {f['path']}: {f.get('description', '')}"
        for f in step.get("files", [])
    )
    existing_context = ""
    if existing_files:
        existing_context = (
            "\nFiles already created in the project:\n"
            + "\n".join(f"  - {f}" for f in existing_files[:30])
            + "\n"
        )

    system = (
        "You are a Senior Fullstack Developer producing production-ready code. "
        "YOU MUST OUTPUT ONLY VALID JSON. NO CONVERSATIONAL TEXT.\n"
        "Your response must be a JSON object with a single 'files' array.\n"
        "Each file has 'path' (relative) and 'content' (the full source code)."
    )
    if skill_contents:
        system += "\n\nYOU MUST STRICTLY FOLLOW THESE CAPABILITY SKILLS:\n\n" + "\n\n---\n\n".join(skill_contents)

    user = (
        f"You are implementing Step {step['step_number']}: {step['description']}\n\n"
        f"Overall Task: {title}\n"
        f"Description: {desc}\n"
        f"Requirements: {reqs}\n\n"
        f"Architectural Blueprint:\n{blueprint[:3000]}\n\n"
        f"{existing_context}\n"
        f"Files to create in THIS step:\n{files_desc}\n\n"
        "Return JSON: {\"files\": [{\"path\": \"...\", \"content\": \"...\"}]}"
    )

    result = llm_json(system, user, max_tokens=16384, complexity="high")
    return result.get("files", []) if isinstance(result, dict) else []


# ═══════════════════════════════════════════════════════════════════════════
# MAIN PROCESS
# ═══════════════════════════════════════════════════════════════════════════

def process_task(client: TaskHiveClient, task_id: int) -> dict:
    try:
        task = client.get_task(task_id)
        if not task:
            return {"action": "error", "error": f"Task {task_id} not found."}

        # Load / initialize state
        task_dir = WORKSPACE_DIR / f"task_{task_id}"
        task_dir.mkdir(parents=True, exist_ok=True)
        state_file = task_dir / ".swarm_state.json"

        state = {
            "status": "coding",
            "current_step": 0,
            "total_steps": 0,
            "completed_steps": [],
            "commit_log": [],
            "iterations": 0,
            "files": [],
            "test_command": "echo 'No tests defined'",
        }
        if state_file.exists():
            with open(state_file, "r") as f:
                state = json.load(f)

        if state.get("status") != "coding":
            return {"action": "no_result", "reason": f"State is {state.get('status')}, not coding."}

        title = task.get("title") or ""
        desc = task.get("description") or ""
        reqs = task.get("requirements") or ""
        past_errors = state.get("test_errors", "")

        # ── STEP 1: Git Repo (Create FIRST, before any code) ──────────
        log_think(f"Initializing Git repo for task #{task_id}...", AGENT_NAME)
        append_build_log(task_dir, f"=== Coder Agent starting for task #{task_id} ===")

        if not init_repo(task_dir):
            return {"action": "error", "error": "Failed to initialize git repo."}

        repo_url = create_github_repo(task_id, task_dir)
        if repo_url:
            log_ok(f"GitHub repo ready: {repo_url}", AGENT_NAME)
            state["repo_url"] = repo_url
        else:
            log_warn("GitHub repo creation failed — continuing with local git only.", AGENT_NAME)
            state["repo_url"] = get_repo_url(task_id)

        # ── STEP 2: Plan (or resume from existing plan) ───────────────
        if not state.get("plan"):
            log_think(f"Planning implementation for task #{task_id}...", AGENT_NAME)

            plan = plan_implementation(title, desc, reqs, past_errors)
            if not plan or not plan.get("steps"):
                log_warn("Planning failed, falling back to single-step approach.", AGENT_NAME)
                plan = {
                    "project_type": "node",
                    "scaffold_command": None,
                    "steps": [{"step_number": 1, "description": "Complete implementation", "commit_message": "feat: complete implementation", "files": []}],
                    "test_command": "echo 'No tests defined'",
                }

            state["plan"] = plan
            state["total_steps"] = len(plan.get("steps", []))
            state["test_command"] = plan.get("test_command", "echo 'No tests defined'")
            _save_state(state_file, state)

            # Commit the plan
            plan_file = task_dir / ".implementation_plan.json"
            plan_file.write_text(json.dumps(plan, indent=2), encoding="utf-8")
            h = commit_step(task_dir, "docs: add implementation plan")
            if h:
                append_commit_log(task_dir, h, "docs: add implementation plan")
                log_ok(f"Committed implementation plan [{h}]", AGENT_NAME)
        else:
            plan = state["plan"]
            log_think(f"Resuming plan — {len(state.get('completed_steps', []))} of {state['total_steps']} steps done.", AGENT_NAME)

        # ── STEP 3: Scaffold (if needed) ──────────────────────────────
        scaffold_cmd = plan.get("scaffold_command")
        if scaffold_cmd and not state.get("scaffolded"):
            log_think(f"Scaffolding project: {scaffold_cmd}", AGENT_NAME)
            append_build_log(task_dir, f"Scaffold: {scaffold_cmd}")

            rc, out = run_shell_combined(scaffold_cmd, task_dir, timeout=120)
            log_command(task_dir, scaffold_cmd, rc, out)

            if rc == 0:
                h = commit_step(task_dir, f"chore: scaffold project ({plan.get('project_type', 'unknown')})")
                if h:
                    append_commit_log(task_dir, h, "chore: scaffold project")
                    log_ok(f"Scaffolded and committed [{h}]", AGENT_NAME)

                state["scaffolded"] = True
                _save_state(state_file, state)
            else:
                log_warn(f"Scaffold command failed (rc={rc}). Continuing anyway.", AGENT_NAME)
                state["scaffolded"] = True  # Don't retry
                _save_state(state_file, state)

        # ── STEP 4: Generate code for remaining Architectural blueprint ─
        log_think("Requesting architectural blueprint enhancement...", AGENT_NAME)

        prompt = (
            f"You are the Coder Agent. We are building a solution for this task:\n"
            f"Title: {title}\nDescription: {desc}\nRequirements: {reqs}\n"
        )
        if past_errors:
            prompt += f"\nPREVIOUS TEST FAILED WITH THIS ERROR:\n{past_errors}\nYou must fix this.\n"

        enhanced_blueprint = kimi_enhance_prompt(prompt)

        # Load skills
        skills_dir = Path("f:/TaskHive/TaskHive/skills")
        skill_contents = []
        if skills_dir.exists():
            for md_file in skills_dir.glob("*.md"):
                try:
                    skill_contents.append(md_file.read_text(encoding="utf-8"))
                except Exception:
                    pass

        # ── STEP 5: Execute each step ─────────────────────────────────
        steps = plan.get("steps", [])
        completed_step_nums = {s["step_number"] for s in state.get("completed_steps", [])}
        existing_files = []

        # Collect files already written
        for s in state.get("completed_steps", []):
            existing_files.extend(s.get("files_written", []))

        for step in steps:
            step_num = step.get("step_number", 0)
            if step_num in completed_step_nums:
                continue  # Already done

            step_desc = step.get("description", f"Step {step_num}")
            commit_msg = step.get("commit_message", f"feat: {step_desc}")

            log_think(f"Step {step_num}/{len(steps)}: {step_desc}", AGENT_NAME)
            append_build_log(task_dir, f"Step {step_num}: {step_desc}")

            # Generate code for this step
            files = generate_step_code(
                step, title, desc, reqs, enhanced_blueprint,
                existing_files, skill_contents,
            )

            if not files:
                log_warn(f"Step {step_num} generated no files — skipping.", AGENT_NAME)
                continue

            # Write files to disk
            files_written = []
            for f in files:
                file_path = task_dir / f["path"]
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(f["content"], encoding="utf-8")
                files_written.append(f["path"])
                existing_files.append(f["path"])

            log_think(f"  Wrote {len(files_written)} files: {', '.join(files_written[:5])}", AGENT_NAME)

            # Commit this step
            h = commit_step(task_dir, commit_msg)
            if h:
                append_commit_log(task_dir, h, commit_msg)
                log_ok(f"  Committed [{h}]: {commit_msg}", AGENT_NAME)

                # Push every few commits
                if should_push(task_dir):
                    push_to_remote(task_dir)
                    log_ok("  Pushed to GitHub", AGENT_NAME)

            # Track completed step
            state["current_step"] = step_num
            state["completed_steps"].append({
                "step_number": step_num,
                "description": step_desc,
                "commit": h,
                "files_written": files_written,
            })
            state["files"].extend(files)
            _save_state(state_file, state)

        # ── STEP 6: Install dependencies ──────────────────────────────
        if (task_dir / "package.json").exists():
            log_think("Installing npm dependencies...", AGENT_NAME)
            rc, out = run_npm_install(task_dir)
            log_command(task_dir, "npm install", rc, out)
            if rc == 0:
                log_ok("npm install succeeded.", AGENT_NAME)
            else:
                log_warn(f"npm install failed (rc={rc})", AGENT_NAME)

        # ── STEP 7: Final push ────────────────────────────────────────
        push_to_remote(task_dir)
        log_ok(f"All code pushed to {state.get('repo_url', 'GitHub')}", AGENT_NAME)

        # ── Transition to testing ─────────────────────────────────────
        state["status"] = "testing"
        state["iterations"] = state.get("iterations", 0) + 1
        _save_state(state_file, state)

        total_files = sum(len(s.get("files_written", [])) for s in state.get("completed_steps", []))
        total_commits = len(state.get("commit_log", []))

        log_ok(
            f"Coding complete for task #{task_id} — "
            f"{total_files} files, {total_commits} commits, "
            f"{len(state.get('completed_steps', []))} steps",
            AGENT_NAME
        )

        return {
            "action": "coded",
            "task_id": task_id,
            "files_written": total_files,
            "commits": total_commits,
            "repo_url": state.get("repo_url"),
        }

    except Exception as e:
        log_err(f"Exception during coding: {e}")
        log_err(traceback.format_exc().strip().splitlines()[-1])
        return {"action": "error", "error": str(e)}


def _save_state(state_file: Path, state: dict):
    """Save state to disk."""
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--task-id", type=int, required=True)
    args = parser.parse_args()

    client = TaskHiveClient(args.base_url, args.api_key)
    result = process_task(client, args.task_id)
    print(f"\n__RESULT__:{json.dumps(result, ensure_ascii=True)}")

if __name__ == "__main__":
    main()
