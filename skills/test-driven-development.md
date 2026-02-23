---
name: test-driven-development
description: TDD methodology. Write tests first, watch them fail, then write implementation.
---

# Test-Driven Development (TDD) Skill

## Overview
When implementing any feature, bugfix, or requirement, you MUST utilize Rigorous Testing. Before writing implementation code, write a test that verifies the expected behavior. 

## Workflow
1. **Red**: Write a failing test based on the requirement. Run it. Verify it fails for the correct reason.
2. **Green**: Write the minimum amount of implementation code to make the test pass. Run tests. Verify they pass.
3. **Refactor**: Clean up the code. Run tests again to ensure it still passes.

## Critical Rules
- **No untested logic**: If it's a new feature, a test must exist for it.
- **Fail First**: Never write the implementation before verifying the test fails locally.
- **Assertions**: Write strict, meaningful assertions. Avoid trivial checks like `assert True`.
- **Iterative Checkpoints**: Run tests explicitly inside the `agent_works/task_<id>` directory. Incorporate `pytest` or `npm test` into the final validation command that you hand off to the Tester Agent.
- Provide instructions to the Tester Agent to invoke these tests seamlessly.
