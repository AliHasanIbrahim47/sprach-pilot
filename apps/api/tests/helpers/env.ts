/** Local-only Ed25519 material. Production must use a different key. */
const TEST_PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEILeSL+go0sAV+fxz9BnmSVqztp5F9Cganhb+P5S9B73s",
  "-----END PRIVATE KEY-----",
].join("\n");

const TEST_PUBLIC_KEY = [
  "-----BEGIN PUBLIC KEY-----",
  "MCowBQYDK2VwAyEAwUtWX075tnJtpfy7YWoXjvhCxV251yY42rvApnJGaRk=",
  "-----END PUBLIC KEY-----",
].join("\n");

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
    JWT_ACTIVE_KID: "test-key",
    JWT_PRIVATE_KEY: TEST_PRIVATE_KEY,
    JWT_PUBLIC_KEYS: JSON.stringify([{ kid: "test-key", pem: TEST_PUBLIC_KEY }]),
    JWT_REFRESH_PEPPER: "jwt-refresh-pepper-value",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-oauth-secret",
    IP_HASH_SECRET: "ip-hash-secret-value",
    INTERNAL_API_SECRET: "internal-api-secret-value",
    ...overrides,
  };
}
