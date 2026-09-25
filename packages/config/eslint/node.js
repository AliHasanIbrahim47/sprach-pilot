import security from "eslint-plugin-security";

import { baseConfig } from "./base.js";

/** @type {import("eslint").Linter.Config[]} */
export const nodeConfig = [...baseConfig, security.configs.recommended];

export default nodeConfig;
