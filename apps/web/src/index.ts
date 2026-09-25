import { createHealthStatus } from "@sprachpilot/shared";
import type { HealthStatus } from "@sprachpilot/shared";

/**
 * Web skeleton placeholder. Next.js App Router arrives in SP-004.
 */
export function getWebHealth(): HealthStatus {
  return createHealthStatus("web");
}

const health = getWebHealth();
console.log(`[web] ${health.service} status=${health.status}`);
