import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

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
export const nextjsConfig = [
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    settings: {
      react: {
        // React arrives with the Next.js skeleton (SP-004).
        version: "19.0",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/prop-types": "off",
      "@next/next/no-html-link-for-pages": "off",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use publicConfig / serverConfig instead of process.env.",
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

export default nextjsConfig;
