import { NextResponse } from "next/server";
import crypto from "crypto";

function generateRequestId(): string {
  return `req_${crypto.randomUUID().split("-")[0]}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

interface SuccessMeta {
  timestamp: string;
  request_id: string;
  cursor?: string | null;
  has_more?: boolean;
  count?: number;
}

export function successResponse<T>(
  data: T,
  status: number = 200,
  pagination?: { cursor: string | null; has_more: boolean; count: number }
): NextResponse {
  const meta: SuccessMeta = {
    timestamp: nowISO(),
    request_id: generateRequestId(),
  };

  if (pagination) {
    meta.cursor = pagination.cursor;
    meta.has_more = pagination.has_more;
    meta.count = pagination.count;
  }

  return NextResponse.json({ ok: true, data, meta }, { status });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  suggestion: string
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, suggestion },
      meta: {
        timestamp: nowISO(),
        request_id: generateRequestId(),
      },
    },
    { status }
  );
}
