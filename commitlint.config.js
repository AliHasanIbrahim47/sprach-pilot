/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["api", "web", "worker", "db", "infra", "docs", "shared", "config", "repo"],
    ],
  },
};

export default config;
