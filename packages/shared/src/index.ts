/**
 * Shared types and Zod contracts used across apps (SP-006 / SP-009).
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

export type { LoginBody, LoginSuccessResponse } from "./auth/login.js";
export { loginBodySchema, loginSuccessResponseSchema } from "./auth/login.js";
export { AUTH_COPY } from "./auth/messages.js";
export type { RegisterAcceptedResponse, RegisterBody } from "./auth/register.js";
export { registerAcceptedResponseSchema, registerBodySchema } from "./auth/register.js";
export type { AppErrorCode, AppErrorOptions } from "./errors/app-error.js";
export {
  AppError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "./errors/app-error.js";
export { ERROR_TYPE_BASE } from "./errors/constants.js";
export type {
  FieldError,
  ProblemContext,
  ProblemDetails,
  ProblemSource,
} from "./errors/problem-details.js";
export {
  fieldErrorSchema,
  problemDetailsSchema,
  toProblemDetails,
  validationProblem,
} from "./errors/problem-details.js";
export type { CheckStatus, DependencyName, LivenessResponse, ReadinessResponse } from "./health.js";
export {
  checkStatusSchema,
  dependencyNameSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from "./health.js";
export type { CursorPage, CursorPageMeta, CursorPaginationQuery } from "./pagination/cursor.js";
export {
  createCursorPage,
  cursorPageMetaSchema,
  cursorPaginationQuerySchema,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "./pagination/cursor.js";
