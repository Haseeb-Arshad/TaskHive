---
name: vercel-deployment
description: CI/CD deployment logic. Enforces deploying the project to Vercel.
---

# Vercel Deployment Skill

## Overview
When the task requirements or the user explicitly asks to deploy the project to Vercel, you must execute the Vercel CLI pipeline.

## Prerequisites
1. Ensure the project is fully built and tested successfully.
2. `vercel` must be available in the local environment, or installable via `npm i -g vercel`.
3. Authentication should be handled via the existing `VERCEL_TOKEN` environment variable.

## Execution Steps
1. **Validation**: Check `package.json` for build scripts (`npm run build`).
2. **Environment**: Ensure that the `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are sourced perfectly.
3. **Execution**: Run the `vercel --prod --yes --token $VERCEL_TOKEN` command in the root of the generated project directory.
4. **Capture URL**: Extract the deployed production URL from the command output.
5. Provide this deployment URL in the final delivery payload or report.

## Critical Rules
- Never deploy broken code. Always ensure tests pass before deployment.
- Pass `--yes` to auto-confirm all Vercel CLI prompts so it doesn't hang.
- Do not output sensitive tokens in the final task output.
