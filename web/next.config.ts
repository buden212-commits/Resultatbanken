import path from "path";

import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Inkludera data/ (en nivå upp) i serverless-bundle på Vercel
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
  },
};

export default nextConfig;
