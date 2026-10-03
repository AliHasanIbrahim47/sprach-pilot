/** Minimal valid env for API tests that call loadConfig. */
export function createValidApiEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PORT: "0",
    DATABASE_URL: "postgresql://sprachpilot:secret@localhost:5432/sprachpilot",
    REDIS_URL: "redis://:redis-secret@localhost:6379",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "s3-access-key",
    S3_SECRET_ACCESS_KEY: "s3-secret-key",
    S3_BUCKET: "sprachpilot-dev",
    S3_FORCE_PATH_STYLE: "true",
    SMTP_HOST: "localhost",
    SMTP_PORT: "1025",
    SMTP_SECURE: "false",
    SMTP_PASS: "smtp-password",
    JWT_ACCESS_SECRET: "jwt-access-secret-value",
    JWT_REFRESH_SECRET: "jwt-refresh-secret-value",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-oauth-secret",
    IP_HASH_SECRET: "ip-hash-secret-value",
    INTERNAL_API_SECRET: "internal-api-secret-value",
    ...overrides,
  };
}
