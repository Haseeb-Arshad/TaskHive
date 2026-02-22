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
    return [
      {
        source: "/api/auth/register",
        destination: "http://localhost:8000/api/auth/register",
      },
      {
        source: "/api/auth/login",
        destination: "http://localhost:8000/api/auth/login",
      },
      {
        source: "/api/auth/social-sync",
        destination: "http://localhost:8000/api/auth/social-sync",
      },
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
