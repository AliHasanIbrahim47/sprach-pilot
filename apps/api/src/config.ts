import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const SHUTDOWN_TIMEOUT_MS = 25_000;
const JSON_BODY_LIMIT = "1mb";
const DEFAULT_PORT = 3001;
const REDACTED = "[REDACTED]";

/**
 * Load `apps/api/.env` for local DX. Existing process.env wins (12-factor).
 * Production injects env via the runtime; a missing file is fine.
 */
function loadLocalEnvFile(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!existsSync(envPath)) return;
  loadEnvFile(envPath);
}

loadLocalEnvFile();

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const aiModeSchema = z.enum(["stub", "local"]).default("stub");

const emptyToUndefined = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value;

const optionalBooleanSchema = z
  .enum(["true", "false", "1", "0", "yes", "no", "on", "off"])
  .optional()
  .transform((value): boolean | undefined => {
    if (value === undefined) return undefined;
    return ["true", "1", "yes", "on"].includes(value);
  });

const requiredBooleanSchema = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no", "on", "off"])
    .optional()
    .transform((value): boolean => {
      if (value === undefined) return fallback;
      return ["true", "1", "yes", "on"].includes(value);
    });

const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().min(0).default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1, "must be a non-empty connection string"),
  REDIS_URL: z.string().min(1, "must be a non-empty connection string"),
  JSON_BODY_LIMIT: z.string().min(1).default(JSON_BODY_LIMIT),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(SHUTDOWN_TIMEOUT_MS),
  ENABLE_API_DOCS: optionalBooleanSchema,

  S3_ENDPOINT: z.string().url("must be a valid URL"),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: requiredBooleanSchema(true),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: requiredBooleanSchema(false),
  SMTP_USER: z.string().optional().transform(emptyToUndefined),
  SMTP_PASS: z.string().optional().transform(emptyToUndefined),

  JWT_ACCESS_SECRET: z.string().optional().transform(emptyToUndefined),
  JWT_REFRESH_SECRET: z.string().optional().transform(emptyToUndefined),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().transform(emptyToUndefined),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().transform(emptyToUndefined),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.string().url().optional()),

  AI_MODE: aiModeSchema,
  ML_SERVICE_URL: z.string().url().default("http://localhost:8081"),
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  LIBRETRANSLATE_URL: z.string().url().default("http://localhost:5000"),
  LANGUAGETOOL_URL: z.string().url().default("http://localhost:8010"),

  FEATURE_REGISTRATION_ENABLED: requiredBooleanSchema(true),

  /** HMAC pepper for client IP hashes. Required; never log the value. */
  IP_HASH_SECRET: z.string().min(16, "must be at least 16 characters"),
  INTERNAL_API_SECRET: z.string().optional().transform(emptyToUndefined),
});

export type ApiConfig = Readonly<{
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  enableApiDocs: boolean | undefined;
  s3: Readonly<{
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
  }>;
  smtp: Readonly<{
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
  }>;
  jwt: Readonly<{
    accessSecret: string | undefined;
    refreshSecret: string | undefined;
  }>;
  oauth: Readonly<{
    google: Readonly<{
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }> | null;
  }>;
  ai: Readonly<{
    mode: z.infer<typeof aiModeSchema>;
    mlServiceUrl: string;
    ollamaUrl: string;
    libreTranslateUrl: string;
    languageToolUrl: string;
  }>;
  features: Readonly<{
    registrationEnabled: boolean;
  }>;
  ipHashSecret: string;
  internalApiSecret: string | undefined;
}>;

const SECRET_KEYS = new Set([
  "databaseUrl",
  "redisUrl",
  "accessKeyId",
  "secretAccessKey",
  "pass",
  "accessSecret",
  "refreshSecret",
  "clientSecret",
  "ipHashSecret",
  "internalApiSecret",
]);

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
  return `Invalid configuration:\n${lines.join("\n")}`;
}

function toApiConfig(env: z.infer<typeof apiEnvSchema>): ApiConfig {
  const googleOAuth =
    env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URI
      ? {
          clientId: env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
          redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
        }
      : null;

  return deepFreeze({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    enableApiDocs: env.ENABLE_API_DOCS,
    s3: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      bucket: env.S3_BUCKET,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
    },
    oauth: { google: googleOAuth },
    ai: {
      mode: env.AI_MODE,
      mlServiceUrl: env.ML_SERVICE_URL,
      ollamaUrl: env.OLLAMA_URL,
      libreTranslateUrl: env.LIBRETRANSLATE_URL,
      languageToolUrl: env.LANGUAGETOOL_URL,
    },
    features: {
      registrationEnabled: env.FEATURE_REGISTRATION_ENABLED,
    },
    ipHashSecret: env.IP_HASH_SECRET,
    internalApiSecret: env.INTERNAL_API_SECRET,
  });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const result = apiEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return toApiConfig(result.data);
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

/** Safe snapshot for startup logs — secret leaf values become `[REDACTED]`. */
export function formatConfigForLog(config: ApiConfig): Record<string, unknown> {
  return redactValue("root", config) as Record<string, unknown>;
}
