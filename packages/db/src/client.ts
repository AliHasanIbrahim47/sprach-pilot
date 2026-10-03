import { PrismaClient } from "@prisma/client";

const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

export interface CreatePrismaClientOptions {
  databaseUrl?: string;
  logQueries?: boolean;
  connectionLimit?: number;
  poolTimeoutSeconds?: number;
}

function withPoolParams(url: string, connectionLimit: number, poolTimeoutSeconds: number): string {
  const parsed = new URL(url);

  if (!parsed.searchParams.has("connection_limit")) {
    parsed.searchParams.set("connection_limit", String(connectionLimit));
  }

  if (!parsed.searchParams.has("pool_timeout")) {
    parsed.searchParams.set("pool_timeout", String(poolTimeoutSeconds));
  }

  return parsed.toString();
}

/**
 * Creates a PrismaClient with connection pool settings and optional query logging.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const databaseUrl = options.databaseUrl ?? process.env["DATABASE_URL"];

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to create a Prisma client. Set it in the environment (see packages/db/.env.example).",
    );
  }

  const isDev = (process.env["NODE_ENV"] ?? "development") === "development";
  const shouldLogQueries = options.logQueries ?? isDev;
  const connectionLimit = options.connectionLimit ?? DEFAULT_CONNECTION_LIMIT;
  const poolTimeoutSeconds = options.poolTimeoutSeconds ?? DEFAULT_POOL_TIMEOUT_SECONDS;

  return new PrismaClient({
    datasources: {
      db: {
        url: withPoolParams(databaseUrl, connectionLimit, poolTimeoutSeconds),
      },
    },
    log: shouldLogQueries
      ? [
          { emit: "stdout", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
      : [{ emit: "stdout", level: "error" }],
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  __sprachpilotPrisma?: PrismaClient;
};

function getOrCreatePrismaClient(): PrismaClient {
  if (!globalForPrisma.__sprachpilotPrisma) {
    globalForPrisma.__sprachpilotPrisma = createPrismaClient();
  }

  return globalForPrisma.__sprachpilotPrisma;
}

/**
 * Process-wide Prisma singleton. Lazily created on first property access so
 * importing `@sprachpilot/db` does not require DATABASE_URL until a query runs.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getOrCreatePrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
