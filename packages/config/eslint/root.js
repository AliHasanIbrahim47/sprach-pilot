import { baseConfig } from "./base.js";
import { nextjsConfig } from "./nextjs.js";
import { nodeConfig } from "./node.js";

function withoutIgnores(configs) {
  return configs.filter((entry) => !entry.ignores);
}

/**
 * Monorepo-wide ESLint config for the repo root (lint-staged / editors).
 */
/** @type {import("eslint").Linter.Config[]} */
export const rootConfig = [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "docs/**",
    ],
  },
  ...withoutIgnores(baseConfig).map((entry) => ({
    ...entry,
    files: entry.files ?? [
      "packages/**/*.{js,mjs,cjs,ts,tsx}",
      "apps/**/*.{js,mjs,cjs,ts,tsx}",
      "*.{js,mjs,cjs}",
    ],
  })),
  ...withoutIgnores(nodeConfig)
    .filter((entry) => entry.plugins?.security)
    .map((entry) => ({
      ...entry,
      files: ["apps/api/**/*.{js,mjs,cjs,ts,tsx}", "apps/worker/**/*.{js,mjs,cjs,ts,tsx}"],
    })),
  ...withoutIgnores(nextjsConfig)
    .filter((entry) => entry.plugins?.react || entry.plugins?.["@next/next"])
    .map((entry) => ({
      ...entry,
      files: ["apps/web/**/*.{js,mjs,cjs,ts,tsx}"],
    })),
];

export default rootConfig;
