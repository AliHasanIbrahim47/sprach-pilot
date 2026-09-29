const SHUTDOWN_TIMEOUT_MS = 25_000;
const JSON_BODY_LIMIT = "1mb";
const DEFAULT_PORT = 3001;

export interface ApiConfig {
  port: number;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  nodeEnv: string;
  /** When set, forces API docs on/off. When unset, docs are on unless production. */
  enableApiDocs: boolean | undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number.parseInt(env["PORT"] ?? String(DEFAULT_PORT), 10);

  return {
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    databaseUrl: env["DATABASE_URL"],
    redisUrl: env["REDIS_URL"],
    jsonBodyLimit: env["JSON_BODY_LIMIT"] ?? JSON_BODY_LIMIT,
    shutdownTimeoutMs: Number.parseInt(
      env["SHUTDOWN_TIMEOUT_MS"] ?? String(SHUTDOWN_TIMEOUT_MS),
      10,
    ),
    nodeEnv: env["NODE_ENV"] ?? "development",
    enableApiDocs: parseOptionalBoolean(env["ENABLE_API_DOCS"]),
  };
}
