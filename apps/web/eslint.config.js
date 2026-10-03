import { nextjsConfig } from "@sprachpilot/config/eslint/nextjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [".next/**", "next-env.d.ts", "coverage/**"],
  },
  ...nextjsConfig,
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
];
