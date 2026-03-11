import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await apiClient("/api/auth/social-sync", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({ error: "Social sync failed" }));

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Social sync proxy error:", error);
    return NextResponse.json(
      { error: "Social sync failed. Please try again." },
      { status: 500 },
    );
  }
}
