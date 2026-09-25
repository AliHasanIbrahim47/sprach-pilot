/**
 * Shared types used across apps. Expanded in later tickets (contracts in SP-006).
 */
export type WorkspaceName = "web" | "api" | "worker" | "db" | "shared";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  service: WorkspaceName;
  timestamp: string;
}

export function createHealthStatus(service: WorkspaceName): HealthStatus {
  return {
    status: "ok",
    service,
    timestamp: new Date().toISOString(),
  };
}
