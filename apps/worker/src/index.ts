import { prisma } from "@sprachpilot/db";
import { createHealthStatus, type HealthStatus } from "@sprachpilot/shared";

/**
 * Background worker placeholder. Job processing arrives with later tickets.
 */
export function getWorkerHealth(): HealthStatus {
  return createHealthStatus("worker");
}

export async function disconnectWorkerDb(): Promise<void> {
  await prisma.$disconnect();
}

const health = getWorkerHealth();
console.log(`[worker] ${health.service} status=${health.status} db=@sprachpilot/db`);
