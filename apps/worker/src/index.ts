import { createHealthStatus } from "@sprachpilot/shared";
import type { HealthStatus } from "@sprachpilot/shared";

/**
 * Background worker placeholder. Job processing arrives with later tickets.
 */
export function getWorkerHealth(): HealthStatus {
  return createHealthStatus("worker");
}

const health = getWorkerHealth();
console.log(`[worker] ${health.service} status=${health.status}`);
