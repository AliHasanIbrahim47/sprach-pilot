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
  };
}
