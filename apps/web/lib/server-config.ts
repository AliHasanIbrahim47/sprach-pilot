import "server-only";

import { z } from "zod";

const REDACTED = "[REDACTED]";

const emptyToUndefined = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value;

const requiredBooleanSchema = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no", "on", "off"])
    .optional()
    .transform((value): boolean => {
      if (value === undefined) return fallback;
      return ["true", "1", "yes", "on"].includes(value);
    });

const serverEnvSchema = z.object({
  API_BASE_URL: z.string().url("must be a valid URL").default("http://localhost:3001"),
  FEATURE_REGISTRATION_ENABLED: requiredBooleanSchema(true),
  FEATURE_GOOGLE_OAUTH: requiredBooleanSchema(false),
  INTERNAL_API_SECRET: z.string().optional().transform(emptyToUndefined),
});

export type ServerConfig = Readonly<{
  apiBaseUrl: string;
  features: Readonly<{
    registrationEnabled: boolean;
    googleOAuthEnabled: boolean;
  }>;
  internalApiSecret: string | undefined;
}>;

const SECRET_KEYS = new Set(["internalApiSecret"]);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Invalid server configuration:\n${lines.join("\n")}`;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = serverEnvSchema.safeParse({
    API_BASE_URL: env["API_BASE_URL"],
    FEATURE_REGISTRATION_ENABLED: env["FEATURE_REGISTRATION_ENABLED"],
    FEATURE_GOOGLE_OAUTH: env["FEATURE_GOOGLE_OAUTH"],
    INTERNAL_API_SECRET: env["INTERNAL_API_SECRET"],
  });
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return deepFreeze({
    apiBaseUrl: result.data.API_BASE_URL,
    features: {
      registrationEnabled: result.data.FEATURE_REGISTRATION_ENABLED,
      googleOAuthEnabled: result.data.FEATURE_GOOGLE_OAUTH,
    },
    internalApiSecret: result.data.INTERNAL_API_SECRET,
  });
}

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.has(key) && typeof value === "string" && value.length > 0) {
    return REDACTED;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      redactValue(nestedKey, nestedValue),
    ]),
  );
}

/** Safe snapshot for server logs — secret leaf values become `[REDACTED]`. */
export function formatServerConfigForLog(config: ServerConfig): Record<string, unknown> {
  return redactValue("root", config) as Record<string, unknown>;
}

/** Server-only config. Never import from Client Components. */
export const serverConfig: ServerConfig = loadServerConfig();
