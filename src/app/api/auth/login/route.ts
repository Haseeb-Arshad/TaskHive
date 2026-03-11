import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await apiClient("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({ error: "Login failed" }));

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Login proxy error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
