import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from bundling the postgres driver. It must be required at
  // runtime by Node.js so that the module is not evaluated during static
  // generation (which would throw "Invalid URL" when DATABASE_URL is absent).
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
