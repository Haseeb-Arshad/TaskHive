import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Resolve the agent_works directory (relative to CWD or absolute via env)
function getWorkspaceDir(): string {
    return process.env.AGENT_WORKSPACE_DIR || path.join(process.cwd(), "agent_works");
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ executionId: string }> }
) {
    const { executionId: executionIdStr } = await params;
    const executionId = parseInt(executionIdStr, 10);
    if (isNaN(executionId)) {
        return NextResponse.json({ ok: false, error: "Invalid execution ID" }, { status: 400 });
    }

    const taskDir = path.join(getWorkspaceDir(), `task_${executionId}`);

    // We want to combine .build_log and any .llm_debug_step_*.txt files
    let combinedLogs = "";

    // 1. Read build log
    const buildLogPath = path.join(taskDir, ".build_log");
    if (fs.existsSync(buildLogPath)) {
        combinedLogs += "=== AGENT TERMINAL LOG ===\n\n";
        combinedLogs += fs.readFileSync(buildLogPath, "utf-8");
        combinedLogs += "\n\n";
    }

    // 2. See if there are any LLM debug logs
    if (fs.existsSync(taskDir)) {
        try {
            const files = fs.readdirSync(taskDir);
            const debugFiles = files.filter(f => f.startsWith(".llm_debug_step_"));

            for (const df of debugFiles) {
                combinedLogs += `\n=== LLM DEBUG OUTPUT (${df}) ===\n\n`;
                const dfPath = path.join(taskDir, df);
                combinedLogs += fs.readFileSync(dfPath, "utf-8");
                combinedLogs += "\n\n";
            }
        } catch (e) {
            // Ignore read errors
        }
    }

    if (!combinedLogs) {
        return NextResponse.json({ ok: true, data: "No logs found for this execution yet." });
    }

    return NextResponse.json({
        ok: true,
        data: combinedLogs,
    });
}
