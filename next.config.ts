import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, a stray lockfile in a parent
  // directory makes Next infer the wrong root and warn on every build.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
