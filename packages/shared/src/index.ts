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
export type {
  AssignRoleBody,
  AssignRoleResponse,
  Permission,
  SessionUser,
  UserRole,
} from "./auth/permissions.js";
export {
  assignRoleBodySchema,
  assignRoleResponseSchema,
  can,
  isUserRole,
  PERMISSIONS,
  permissionSchema,
  sessionUserSchema,
  USER_ROLES,
  userRoleSchema,
} from "./auth/permissions.js";
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
export type { AvatarContentType, AvatarJob } from "./jobs/avatar.js";
export {
  AVATAR_CACHE_CONTROL,
  AVATAR_CONTENT_TYPES,
  AVATAR_JOB_NAME,
  AVATAR_QUEUE_NAME,
  avatarJobSchema,
  MAX_AVATAR_BYTES,
} from "./jobs/avatar.js";
export type { EmailJob, EmailTemplate } from "./jobs/email.js";
export {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF_MS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  emailJobSchema,
  emailTemplateSchema,
} from "./jobs/email.js";
export type { GdprExportJob, GdprPurgeJob } from "./jobs/gdpr.js";
export {
  GDPR_EXPORT_JOB_NAME,
  GDPR_JOB_ATTEMPTS,
  GDPR_JOB_BACKOFF_MS,
  GDPR_PURGE_JOB_NAME,
  GDPR_QUEUE_NAME,
  gdprExportJobSchema,
  gdprPurgeJobSchema,
} from "./jobs/gdpr.js";
export type { UiLocale } from "./locale.js";
export { isUiLocale, UI_LOCALES, uiLocaleSchema } from "./locale.js";
export type {
  CityPoint,
  CitySearchResponse,
  CitySuggestion,
  LearningGoal,
  NativeLanguage,
  OnboardingResponse,
  OnboardingStatus,
  OnboardingStep,
  OnboardingStepBody,
  PlacementLevel,
  QuizItem,
  QuizList,
  QuizResult,
  QuizSubmission,
  Scenario,
} from "./onboarding/contracts.js";
export {
  cityPointSchema,
  citySearchQuerySchema,
  citySearchResponseSchema,
  citySuggestionSchema,
  isOnboardingPending,
  LEARNING_GOALS,
  learningGoalSchema,
  MAX_NATIVE_LANGUAGES,
  NATIVE_LANGUAGE_CODES,
  nativeLanguageSchema,
  ONBOARDING_STEPS,
  onboardingResponseSchema,
  onboardingStatusSchema,
  onboardingStepBodySchema,
  onboardingStepSchema,
  PLACEMENT_LEVELS,
  placementLevelSchema,
  quizItemSchema,
  quizListSchema,
  quizResultSchema,
  quizSubmissionSchema,
  scenarioSchema,
} from "./onboarding/contracts.js";
export type { CursorPage, CursorPageMeta, CursorPaginationQuery } from "./pagination/cursor.js";
export {
  createCursorPage,
  cursorPageMetaSchema,
  cursorPaginationQuerySchema,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "./pagination/cursor.js";
export {
  anonymizedEmail,
  DELETED_USER_LABEL,
  GDPR_GRACE_MS,
  isOptionalConsentPolicy,
  OPTIONAL_CONSENT_POLICIES,
  PII_COLUMNS,
  PRIVACY_CONSENT_VERSION,
  REQUIRED_CONSENT_POLICIES,
  REQUIRED_PRIVACY_DOMAINS,
} from "./privacy/constants.js";
export type { PrivacyConsent, PrivacyOverview, UpdateConsentBody } from "./privacy/contracts.js";
export {
  consentDecisionSchema,
  deletionAcceptedSchema,
  exportAcceptedSchema,
  privacyConsentSchema,
  privacyOverviewSchema,
  updateConsentBodySchema,
} from "./privacy/contracts.js";
export type { PrivacyExportData, PurgeIdentity, TandemMessage } from "./privacy/export-data.js";
export {
  anonymizeTandemMessages,
  buildExportZip,
  exportEntries,
  purgeIdentity,
} from "./privacy/export-data.js";
export { signExportToken, verifyExportToken } from "./privacy/token.js";
export type { ZipEntry } from "./privacy/zip.js";
export { unzipStore, zipStore } from "./privacy/zip.js";
export type {
  EmailChangeBody,
  EmailChangeConfirmBody,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
  PasswordChangeBody,
  QuietHours,
  SettingsProfile,
  SettingsResponse,
  UpdateProfileBody,
} from "./settings/contracts.js";
export {
  avatarAcceptedSchema,
  clockTimeSchema,
  DEFAULT_QUIET_HOURS,
  defaultNotificationPreferences,
  emailChangeAcceptedSchema,
  emailChangeBodySchema,
  emailChangeConfirmBodySchema,
  emailChangeConfirmedSchema,
  isValidTimeZone,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  notificationCategorySchema,
  notificationChannelSchema,
  notificationPreferencesSchema,
  passwordChangeBodySchema,
  passwordChangeResponseSchema,
  quietHoursSchema,
  SETTINGS_COPY,
  settingsProfileSchema,
  settingsResponseSchema,
  updateProfileBodySchema,
} from "./settings/contracts.js";
export type { QuietHoursWindow } from "./settings/quiet-hours.js";
export {
  clockToMinute,
  isWithinQuietHours,
  minuteToClock,
  notificationIsAllowed,
} from "./settings/quiet-hours.js";
export { publicObjectUrl } from "./storage/public-url.js";
