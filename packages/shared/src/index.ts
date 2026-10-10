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

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth/cookies.js";
export type {
  AccountResponse,
  PasswordForgotBody,
  PasswordResetBody,
  PasswordResetResponse,
  ResendVerificationBody,
  VerifyEmailQuery,
  VerifyEmailResponse,
} from "./auth/email-flows.js";
export {
  accountResponseSchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  passwordResetResponseSchema,
  resendVerificationBodySchema,
  verifyEmailQuerySchema,
  verifyEmailResponseSchema,
} from "./auth/email-flows.js";
export type { LoginBody, LoginSuccessResponse } from "./auth/login.js";
export { loginBodySchema, loginSuccessResponseSchema } from "./auth/login.js";
export { AUTH_COPY } from "./auth/messages.js";
export type {
  OAuthAuthenticatedResponse,
  OAuthCallbackResponse,
  OAuthGoogleCallbackBody,
  OAuthGoogleLinkBody,
  OAuthLinkRequiredResponse,
} from "./auth/oauth.js";
export {
  GOOGLE_OAUTH_PROVIDER,
  oauthAuthenticatedResponseSchema,
  oauthCallbackResponseSchema,
  oauthGoogleCallbackBodySchema,
  oauthGoogleLinkBodySchema,
  oauthLinkRequiredResponseSchema,
} from "./auth/oauth.js";
export type { RegisterAcceptedResponse, RegisterBody } from "./auth/register.js";
export { registerAcceptedResponseSchema, registerBodySchema } from "./auth/register.js";
export type { AuthSession, RefreshSuccessResponse, SessionListResponse } from "./auth/sessions.js";
export {
  authSessionSchema,
  refreshSuccessResponseSchema,
  sessionListResponseSchema,
} from "./auth/sessions.js";
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
export type { EmailJob, EmailTemplate } from "./jobs/email.js";
export {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF_MS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  emailJobSchema,
  emailTemplateSchema,
} from "./jobs/email.js";
export type { UiLocale } from "./locale.js";
export { isUiLocale, UI_LOCALES, uiLocaleSchema } from "./locale.js";
export type { CursorPage, CursorPageMeta, CursorPaginationQuery } from "./pagination/cursor.js";
export {
  createCursorPage,
  cursorPageMetaSchema,
  cursorPaginationQuerySchema,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "./pagination/cursor.js";
