import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const requestConfig = path.join(path.dirname(fileURLToPath(import.meta.url)), "i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sprachpilot/shared"],
  // Equivalent to createNextIntlPlugin without pulling @swc/core (native binding).
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next-intl/config": requestConfig,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./i18n/request.ts",
    },
  },
};

export default nextConfig;
