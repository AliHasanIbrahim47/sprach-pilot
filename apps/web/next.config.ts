import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sprachpilot/shared"],
};

export default nextConfig;
