import { prisma } from "@sprachpilot/db";
import { createHealthStatus, type HealthStatus } from "@sprachpilot/shared";

import { formatConfigForLog, loadConfig } from "./config.js";

/**
 * Background worker placeholder. Job processing arrives with later tickets.
 */
export function getWorkerHealth(): HealthStatus {
  return createHealthStatus("worker");
}

export async function disconnectWorkerDb(): Promise<void> {
  await prisma.$disconnect();
}

function startWorker(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.info("[worker] config", formatConfigForLog(config));

  const health = getWorkerHealth();
  console.log(
    `[worker] ${health.service} status=${health.status} db=@sprachpilot/db ai.mode=${config.ai.mode}`,
  );
}

startWorker();
