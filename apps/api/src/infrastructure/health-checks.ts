import { Redis } from "ioredis";
import pg from "pg";

import type { DependencyHealthPort } from "../modules/health/health.schemas.js";

const CHECK_TIMEOUT_MS = 2_000;

export function createDatabaseHealthCheck(databaseUrl: string | undefined): DependencyHealthPort {
  return {
    name: "database",
    async check() {
      if (!databaseUrl) return false;

      const client = new pg.Client({
        connectionString: databaseUrl,
        connectionTimeoutMillis: CHECK_TIMEOUT_MS,
      });

      try {
        await client.connect();
        await client.query("SELECT 1");
        return true;
      } catch {
        return false;
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  };
}

export function createRedisHealthCheck(redisUrl: string | undefined): DependencyHealthPort {
  return {
    name: "redis",
    async check() {
      if (!redisUrl) return false;

      const redis = new Redis(redisUrl, {
        connectTimeout: CHECK_TIMEOUT_MS,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      try {
        await redis.connect();
        const pong = await redis.ping();
        return pong === "PONG";
      } catch {
        return false;
      } finally {
        redis.disconnect();
      }
    },
  };
}
