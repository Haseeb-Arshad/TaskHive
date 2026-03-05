import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from bundling the postgres driver. It must be required at
  // runtime by Node.js so that the module is not evaluated during static
  // generation (which would throw "Invalid URL" when DATABASE_URL is absent).
  serverExternalPackages: ["postgres"],

  // Provide fallback env vars so that prerendering (e.g. /_not-found) doesn't
  // crash with "Invalid URL" when env vars are absent during build.
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  },

  async rewrites() {
    // If NEXT_PUBLIC_API_URL is set, use it. Otherwise fallback to localhost.
    // In production, this proxies Next.js /api/v1 requests to the Python backend.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
