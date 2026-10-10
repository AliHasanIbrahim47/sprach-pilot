import { randomUUID } from "node:crypto";

import {
  type AccountResponse,
  AUTH_COPY,
  ConflictError,
  type EmailJob,
  ForbiddenError,
  isUiLocale,
  type LoginBody,
  type LoginSuccessResponse,
  NotFoundError,
  type PasswordForgotBody,
  type PasswordResetBody,
  type PasswordResetResponse,
  RateLimitedError,
  type RegisterAcceptedResponse,
  type RegisterBody,
  type SessionListResponse,
  type UiLocale,
  UnauthorizedError,
  ValidationError,
  type VerifyEmailResponse,
} from "@sprachpilot/shared";

import type { EmailQueue } from "../email/email-queue.js";
import type { EmailSendLimiter } from "../email/email-rate-limit.js";
import type { UserRepository } from "./auth.repository.js";
import type { EmailTokenRepository } from "./email-token.repository.js";
import type { EmailTokenCodec } from "./email-token-codec.js";
import { hashIp, loginSubjectKey } from "./ip-hash.js";
import type { LoginThrottle } from "./login-throttle.js";
import type { AuthMetrics } from "./metrics.js";
import type { PasswordHasher } from "./password-hasher.js";
import { isCommonPassword } from "./password-policy.js";
import type { SessionRepository } from "./session.repository.js";
import type { TokenService } from "./token.service.js";

/** Draft policy versions until SP-081 publishes the final documents. */
export const CONSENT_POLICIES = [
  { policy: "terms", version: "2026-10-03" },
  { policy: "privacy", version: "2026-10-03" },
] as const;

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface AuthLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface AuthServiceDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  tokens: TokenService;
  throttle: LoginThrottle;
  emailTokens: EmailTokenRepository;
  emailCodec: EmailTokenCodec;
  emailSends: EmailSendLimiter;
  emailQueue: EmailQueue;
  webPublicUrl: string;
  metrics: AuthMetrics;
  hasher: PasswordHasher;
  clock: () => Date;
  ipHashSecret: string;
  registrationEnabled: boolean;
  logger: AuthLogger;
}

export interface AuthRequestContext {
  ip: string;
  userAgent?: string;
  locale?: string;
}

/** Tokens travel in httpOnly cookies. Callers must not put these fields in JSON. */
export interface IssuedCredentials {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
}

export interface AuthenticatedResult extends LoginSuccessResponse {
  credentials: IssuedCredentials;
}

export interface AuthService {
  register(input: RegisterBody, context: AuthRequestContext): Promise<RegisterAcceptedResponse>;
  login(input: LoginBody, context: AuthRequestContext): Promise<AuthenticatedResult>;
  refresh(refreshToken: string): Promise<IssuedCredentials>;
  logout(input: { refreshToken?: string; accessToken?: string }): Promise<void>;
  listSessions(userId: string, currentFamilyId: string): Promise<SessionListResponse>;
  revokeSession(userId: string, familyId: string): Promise<void>;
  verifyEmail(token: string): Promise<VerifyEmailResponse>;
  resendVerification(
    input: { userId?: string; email?: string },
    context: AuthRequestContext,
  ): Promise<RegisterAcceptedResponse>;
  forgotPassword(
    input: PasswordForgotBody,
    context: AuthRequestContext,
  ): Promise<RegisterAcceptedResponse>;
  resetPassword(input: PasswordResetBody): Promise<PasswordResetResponse>;
  getAccount(userId: string): Promise<AccountResponse>;
}

function acceptedResponse(): RegisterAcceptedResponse {
  return { status: "accepted", message: AUTH_COPY.registerAccepted };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Registration and login (SP-012).
 *
 * Security properties:
 * - argon2id via PasswordHasher; plaintext passwords and hashes are never logged
 * - registration responses are identical for new and existing emails
 * - login failures use one generic message and a dummy hash when the user is missing
 * - five failures in 15 minutes for an email+IP pair block further attempts with 429
 * - consent stores policy version, timestamp, and an HMAC of the client IP
 * - access tokens carry only sub, role, sid, iat, and exp
 * - refresh tokens are stored as an HMAC and rotated on every refresh
 * - reuse of a rotated refresh token revokes the whole session family
 * - verification and reset tokens are 256-bit, stored as an HMAC, and single-use
 * - forgot-password and resend responses do not reveal whether the email exists
 * - outbound mail is queued; the raw token is not written to logs
 */
export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const {
    users,
    sessions,
    tokens,
    throttle,
    emailTokens,
    emailCodec,
    emailSends,
    emailQueue,
    webPublicUrl,
    metrics,
    hasher,
    clock,
    ipHashSecret,
    logger,
  } = dependencies;

  async function issueCredentials(
    user: { id: string; role: string },
    context: AuthRequestContext,
  ): Promise<IssuedCredentials> {
    const now = clock();
    const refreshToken = tokens.createRefreshToken();
    const familyId = randomUUID();
    const session = await sessions.create({
      userId: user.id,
      familyId,
      refreshTokenHash: tokens.hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(now),
      userAgent: deviceUserAgent(context.userAgent),
      ipHash: hashIp(context.ip, ipHashSecret),
      now,
    });
    return credentialsFor(user, session.familyId, refreshToken, now);
  }

  function refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + tokens.refreshTtlSeconds * 1000);
  }

  async function credentialsFor(
    user: { id: string; role: string },
    familyId: string,
    refreshToken: string,
    now: Date,
  ): Promise<IssuedCredentials> {
    const accessToken = await tokens.signAccessToken(
      { sub: user.id, role: user.role, sid: familyId },
      now,
    );
    return {
      accessToken,
      refreshToken,
      accessMaxAgeSeconds: tokens.accessTtlSeconds,
      refreshMaxAgeSeconds: tokens.refreshTtlSeconds,
    };
  }

  return {
    async register(input, context) {
      if (!dependencies.registrationEnabled) {
        metrics.recordRegister("disabled");
        throw new ForbiddenError("Registration is currently disabled");
      }

      if (isCommonPassword(input.password)) {
        metrics.recordRegister("rejected");
        throw new ValidationError({
          errors: [
            {
              field: "password",
              code: "password_too_common",
              message: AUTH_COPY.passwordTooCommon,
            },
          ],
        });
      }

      const email = normalizeEmail(input.email);
      const passwordHash = await hasher.hash(input.password);
      const existing = await users.findByEmail(email);
      const locale = resolveLocale(context.locale);

      if (existing) {
        if (existing.deletedAt === null) {
          await enqueueRegistrationNotice(
            existing,
            resolveLocale(context.locale, existing.uiLocale),
          );
        }
        metrics.recordRegister("duplicate");
        return acceptedResponse();
      }

      const acceptedAt = clock();
      const ipHash = hashIp(context.ip, ipHashSecret);
      const created = await users.createWithConsent({
        email,
        passwordHash,
        displayName: input.displayName,
        uiLocale: locale,
        consents: CONSENT_POLICIES.map((policy) => ({
          policy: policy.policy,
          version: policy.version,
          acceptedAt,
          ipHash,
        })),
      });

      if (created.status === "duplicate") {
        metrics.recordRegister("duplicate");
        return acceptedResponse();
      }

      await enqueueVerification({ id: created.id, email, uiLocale: locale }, locale);
      metrics.recordRegister("created");
      logger.info("registration created");
      return acceptedResponse();
    },

    async login(input, context) {
      const email = normalizeEmail(input.email);
      const ipHash = hashIp(context.ip, ipHashSecret);
      const subjectKey = loginSubjectKey(email, ipHash, ipHashSecret);
      const retryAfterSeconds = await throttle.getBlock(subjectKey);

      if (retryAfterSeconds !== null) {
        metrics.recordLogin("locked");
        throw new RateLimitedError("Too many login attempts. Try again later.", {
          retryAfterSeconds,
        });
      }

      const user = await users.findByEmail(email);
      const activeUser = user && user.deletedAt === null ? user : null;
      const passwordOk = await hasher.verify(
        activeUser ? activeUser.passwordHash : await hasher.dummyHash(),
        input.password,
      );

      if (!activeUser || !passwordOk) {
        await throttle.recordFailure(subjectKey);
        metrics.recordLogin("failure");
        throw new UnauthorizedError(AUTH_COPY.invalidCredentials);
      }

      await throttle.reset(subjectKey);
      metrics.recordLogin("success");
      const credentials = await issueCredentials(activeUser, context);
      return {
        status: "authenticated",
        user: {
          id: activeUser.id,
          displayName: activeUser.displayName,
          emailVerified: activeUser.emailVerifiedAt !== null,
        },
        credentials,
      };
    },

    async refresh(refreshToken) {
      const now = clock();
      const nextRefreshToken = tokens.createRefreshToken();
      const outcome = await sessions.rotate({
        refreshTokenHash: tokens.hashRefreshToken(refreshToken),
        nextRefreshTokenHash: tokens.hashRefreshToken(nextRefreshToken),
        expiresAt: refreshExpiry(now),
        now,
      });

      if (outcome.status === "reuse") {
        metrics.recordRefresh("reuse");
        metrics.recordTokenReuse();
        logger.info("refresh token reuse detected", {
          familyId: outcome.familyId,
          userId: outcome.userId,
        });
        throw new UnauthorizedError();
      }

      if (outcome.status === "expired") {
        metrics.recordRefresh("expired");
        throw new UnauthorizedError();
      }

      if (outcome.status === "invalid") {
        metrics.recordRefresh("invalid");
        throw new UnauthorizedError();
      }

      const user = await users.findById(outcome.session.userId);
      if (!user || user.deletedAt !== null) {
        await sessions.revokeFamily({
          familyId: outcome.session.familyId,
          reason: "revoked",
          now,
        });
        metrics.recordRefresh("invalid");
        throw new UnauthorizedError();
      }

      metrics.recordRefresh("success");
      return credentialsFor(user, outcome.session.familyId, nextRefreshToken, now);
    },

    async logout(input) {
      const now = clock();

      if (input.refreshToken) {
        const row = await sessions.findByRefreshTokenHash(
          tokens.hashRefreshToken(input.refreshToken),
        );
        if (row?.rotatedAt) {
          await sessions.revokeFamily({ familyId: row.familyId, reason: "reuse", now });
          metrics.recordTokenReuse();
          logger.info("refresh token reuse detected", {
            familyId: row.familyId,
            userId: row.userId,
          });
          return;
        }
        if (row && row.revokedAt === null) {
          await sessions.revokeFamily({ familyId: row.familyId, reason: "logout", now });
          return;
        }
      }

      if (!input.accessToken) return;

      try {
        const claims = await tokens.verifyAccessToken(input.accessToken);
        await sessions.revokeFamily({
          familyId: claims.sid,
          userId: claims.sub,
          reason: "logout",
          now,
        });
      } catch {
        // An expired or forged access token still clears cookies at the HTTP layer.
      }
    },

    async listSessions(userId, currentFamilyId) {
      const rows = await sessions.listActive(userId, clock());
      return {
        sessions: rows.map((row) => ({
          id: row.familyId,
          current: row.familyId === currentFamilyId,
          userAgent: row.userAgent,
          createdAt: row.createdAt.toISOString(),
          lastUsedAt: row.lastUsedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
        })),
      };
    },

    async revokeSession(userId, familyId) {
      const ownsFamily = await sessions.familyBelongsToUser(familyId, userId);
      if (!ownsFamily) throw new NotFoundError("Session not found");
      await sessions.revokeFamily({
        familyId,
        userId,
        reason: "revoked",
        now: clock(),
      });
    },

    async verifyEmail(token) {
      const outcome = await emailTokens.consume(emailCodec.hash(token), clock());
      if (outcome.status === "used") throw tokenUsed();
      if (outcome.status === "expired") throw tokenExpired();
      if (outcome.status === "invalid") throw tokenInvalid();
      await users.markEmailVerified(outcome.userId, clock());
      return { status: "verified", message: AUTH_COPY.emailVerified };
    },

    async resendVerification(input, context) {
      const user = await findResendUser(input);
      if (user && user.deletedAt === null && user.emailVerifiedAt === null) {
        await enqueueVerification(user, resolveLocale(context.locale, user.uiLocale));
      }
      return { status: "accepted", message: AUTH_COPY.verificationResent };
    },

    async forgotPassword(input, context) {
      const email = normalizeEmail(input.email);
      const user = await users.findByEmail(email);
      if (user && user.deletedAt === null) {
        const locale = resolveLocale(context.locale, user.uiLocale);
        const allowed = await emailSends.consume(user.email, "password_reset");
        if (allowed) {
          const token = emailCodec.create();
          const now = clock();
          await emailTokens.insert({
            userId: user.id,
            purpose: "password_reset",
            tokenHash: emailCodec.hash(token),
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
            now,
          });
          await safeEnqueue({
            to: user.email,
            locale,
            template: "reset-password",
            url: buildAppLink(webPublicUrl, locale, "/reset-password", token),
          });
        }
      }
      return { status: "accepted", message: AUTH_COPY.passwordResetAccepted };
    },

    async resetPassword(input) {
      if (isCommonPassword(input.password)) {
        throw new ValidationError({
          errors: [
            {
              field: "password",
              code: "password_too_common",
              message: AUTH_COPY.passwordTooCommon,
            },
          ],
        });
      }

      const now = clock();
      const outcome = await emailTokens.consume(emailCodec.hash(input.token), now);
      if (outcome.status === "used") throw tokenUsed();
      if (outcome.status === "expired") throw tokenExpired();
      if (outcome.status === "invalid") throw tokenInvalid();

      await users.updatePassword(outcome.userId, await hasher.hash(input.password));
      await sessions.revokeAllForUser({
        userId: outcome.userId,
        reason: "password_reset",
        now: clock(),
      });
      return { status: "reset", message: AUTH_COPY.passwordResetComplete };
    },

    async getAccount(userId) {
      const user = await users.findById(userId);
      if (!user || user.deletedAt) throw new UnauthorizedError();
      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        locale: user.uiLocale,
      };
    },
  };

  async function findResendUser(input: { userId?: string; email?: string }) {
    if (input.userId) return users.findById(input.userId);
    if (input.email) return users.findByEmail(normalizeEmail(input.email));
    return null;
  }

  async function enqueueVerification(
    user: { id: string; email: string; uiLocale: UiLocale },
    locale: UiLocale,
  ): Promise<void> {
    const allowed = await emailSends.consume(user.email, "verification");
    if (!allowed) return;
    const token = emailCodec.create();
    const now = clock();
    await emailTokens.insert({
      userId: user.id,
      purpose: "email_verification",
      tokenHash: emailCodec.hash(token),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
      now,
    });
    await safeEnqueue({
      to: user.email,
      locale,
      template: "verify-email",
      url: buildAppLink(webPublicUrl, locale, "/verify-email", token),
    });
  }

  async function enqueueRegistrationNotice(
    user: { email: string; uiLocale: UiLocale },
    locale: UiLocale,
  ): Promise<void> {
    const allowed = await emailSends.consume(user.email, "registration_notice");
    if (!allowed) return;
    await safeEnqueue({
      to: user.email,
      locale,
      template: "registration-notice",
    });
  }

  async function safeEnqueue(job: EmailJob): Promise<void> {
    try {
      await emailQueue.enqueue(job);
    } catch (error) {
      logger.error("email enqueue failed", {
        template: job.template,
        reason: error instanceof Error ? error.name : "Error",
      });
    }
  }
}

function resolveLocale(requested: string | undefined, fallback: UiLocale = "en"): UiLocale {
  if (requested && isUiLocale(requested)) return requested;
  return fallback;
}

function buildAppLink(origin: string, locale: UiLocale, path: string, token: string): string {
  const url = new URL(`${origin.replace(/\/$/, "")}/${locale}${path}`);
  url.searchParams.set("token", token);
  return url.toString();
}

function tokenUsed(): ConflictError {
  return new ConflictError(AUTH_COPY.linkAlreadyUsed, {
    errors: [{ field: "token", code: "token_used", message: AUTH_COPY.linkAlreadyUsed }],
  });
}

function tokenExpired(): ValidationError {
  return new ValidationError({
    detail: AUTH_COPY.linkExpired,
    errors: [{ field: "token", code: "token_expired", message: AUTH_COPY.linkExpired }],
  });
}

function tokenInvalid(): ValidationError {
  return new ValidationError({
    detail: AUTH_COPY.linkInvalid,
    errors: [{ field: "token", code: "token_invalid", message: AUTH_COPY.linkInvalid }],
  });
}

function deviceUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replaceAll("\u0000", "");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 256);
}
