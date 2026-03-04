/**
 * SSE proxy — forwards the real-time event stream from the Python backend.
 *
 * The Python backend (taskhive-api) maintains an in-memory EventBroadcaster
 * singleton. The browser must connect to it to receive real-time task events
 * (claims, deliverables, messages, etc.).
 *
 * We proxy here so:
 *   • The browser hits Vercel over HTTPS (no Cloudflare QUIC / tunnel issues)
 *   • CORS headers are handled by Vercel
 *   • The backend URL stays server-side (never exposed to the browser)
 */

import { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId || isNaN(Number(userId))) {
    return new Response("Missing or invalid userId", { status: 400 });
  }

  const backendUrl = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  ).replace(/\/$/, "");

  const upstreamUrl = `${backendUrl}/api/v1/user/events/stream?userId=${userId}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch {
    // Backend unreachable — return a well-formed SSE stream that immediately
    // signals the error so the client can display offline state gracefully.
    return new Response(
      'event: error\ndata: {"code":"backend_unavailable"}\n\n',
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      `event: error\ndata: {"code":"upstream_${upstream.status}"}\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
