import type { HealthRepository } from "./health.repository.js";
import type {
  CheckStatus,
  DependencyName,
  LivenessResponse,
  ReadinessResponse,
} from "./health.schemas.js";

export interface HealthService {
  getLiveness(): LivenessResponse;
  getReadiness(): Promise<ReadinessResponse>;
}

export function createHealthService(repository: HealthRepository): HealthService {
  return {
    getLiveness() {
      return { status: "ok" };
    },

    async getReadiness() {
      const results = await repository.checkDependencies();
      const checks = {} as Record<DependencyName, CheckStatus>;
      const failing: DependencyName[] = [];

      for (const result of results) {
        checks[result.name] = result.ok ? "ok" : "fail";
        if (!result.ok) failing.push(result.name);
      }

      return {
        status: failing.length === 0 ? "ok" : "not_ready",
        checks,
        failing,
      };
    },
  };
}
