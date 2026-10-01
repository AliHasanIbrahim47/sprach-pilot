import security from "eslint-plugin-security";

import { baseConfig } from "./base.js";

/** Config modules and tool configs may read process.env directly. */
const processEnvAllowlist = [
  "**/config.ts",
  "**/config/**/*.{js,mjs,cjs,ts,tsx}",
  "**/public-config.ts",
  "**/server-config.ts",
  "**/*.config.{js,mjs,cjs,ts}",
  "**/vitest.setup.ts",
];

/** @type {import("eslint").Linter.Config[]} */
export const nodeConfig = [
  ...baseConfig,
  security.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use the typed config module (loadConfig) instead of process.env.",
        },
      ],
    },
  },
  {
    files: processEnvAllowlist,
    rules: {
      "no-restricted-properties": "off",
    },
  },
];

export default nodeConfig;
