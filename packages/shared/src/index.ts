/**
 * Shared types and Zod contracts used across apps (SP-006).
 * Keep this entry free of OpenAPI generator imports so it can ship to the browser.
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

export type { RegisterAcceptedResponse, RegisterBody } from "./auth/register.js";
export { registerAcceptedResponseSchema, registerBodySchema } from "./auth/register.js";
export type { FieldError, ProblemDetails } from "./errors/problem-details.js";
export {
  ERROR_TYPE_BASE,
  fieldErrorSchema,
  problemDetailsSchema,
  validationProblem,
} from "./errors/problem-details.js";
export type { CheckStatus, DependencyName, LivenessResponse, ReadinessResponse } from "./health.js";
export {
  checkStatusSchema,
  dependencyNameSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from "./health.js";
