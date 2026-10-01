import { prisma } from "@sprachpilot/db";
import { Redis } from "ioredis";

import type { DependencyHealthPort } from "../modules/health/health.schemas.js";

const CHECK_TIMEOUT_MS = 2_000;

export function createDatabaseHealthCheck(): DependencyHealthPort {
  return {
    name: "database",
    async check() {
      try {
        await Promise.race([
          prisma.$queryRaw`SELECT 1`,
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("database health check timed out")),
              CHECK_TIMEOUT_MS,
            );
          }),
        ]);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createRedisHealthCheck(redisUrl: string): DependencyHealthPort {
  return {
    name: "redis",
    async check() {
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
