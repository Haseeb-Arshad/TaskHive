import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

function getWorkspaceDir(): string {
  return process.env.AGENT_WORKSPACE_DIR || path.join(process.cwd(), "agent_works");
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  const taskId = parseInt(executionId, 10);
  if (isNaN(taskId)) {
    return new Response("Invalid execution ID", { status: 400 });
  }

  const taskDir = path.join(getWorkspaceDir(), `task_${taskId}`);
  const progressFile = path.join(taskDir, "progress.jsonl");

  const encoder = new TextEncoder();
  let lastLineCount = 0;
  let closed = false;

  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      // Send all existing progress events immediately
      function readAndSendLines() {
        if (!fs.existsSync(progressFile)) return;
        try {
          const content = fs.readFileSync(progressFile, "utf-8");
          const lines = content.split("\n").filter((l) => l.trim());
          for (let i = lastLineCount; i < lines.length; i++) {
            try {
              const step = JSON.parse(lines[i]);
              const event = `event: progress\ndata: ${JSON.stringify(step)}\n\n`;
              controller.enqueue(encoder.encode(event));
            } catch {
              // skip malformed lines
            }
          }
          lastLineCount = lines.length;
        } catch {
          // file read error — ignore
        }
      }

      // Send existing lines
      readAndSendLines();

      // Send keepalive and check for new lines every 2 seconds
      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
          return;
        }
        // Send keepalive comment
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
          // Check for new progress lines
          readAndSendLines();
        } catch {
          clearInterval(interval);
        }
      }, 2000);

      // Automatically close after 10 minutes to prevent dangling connections
      setTimeout(() => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      }, 10 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
