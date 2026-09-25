import { createHealthStatus, type HealthStatus } from "@sprachpilot/shared";

/**
 * API skeleton placeholder. Express layered architecture arrives in SP-003.
 */
export function getApiHealth(): HealthStatus {
  return createHealthStatus("api");
}

const health = getApiHealth();
console.log(`[api] ${health.service} status=${health.status}`);
