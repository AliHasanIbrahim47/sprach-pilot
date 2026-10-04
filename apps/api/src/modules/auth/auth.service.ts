import { randomUUID } from "node:crypto";

import {
  AUTH_COPY,
  ForbiddenError,
  type LoginBody,
  type LoginSuccessResponse,
  NotFoundError,
  RateLimitedError,
  type RegisterAcceptedResponse,
  type RegisterBody,
  type SessionListResponse,
  UnauthorizedError,
  ValidationError,
} from "@sprachpilot/shared";

import type { UserRepository } from "./auth.repository.js";
import { hashIp, loginSubjectKey } from "./ip-hash.js";
import type { LoginThrottle } from "./login-throttle.js";
import type { Mailer } from "./mailer.js";
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

const DUPLICATE_NOTICE_SUBJECT = "Someone tried to register with your SprachPilot email";
const DUPLICATE_NOTICE_TEXT = [
  "Someone tried to create a SprachPilot account using this email address.",
  "",
  "If that was you, sign in with your existing password.",
  "If it was not you, you can ignore this message. No new account was created.",
].join("\n");

export interface AuthLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface AuthServiceDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  tokens: TokenService;
  throttle: LoginThrottle;
  mailer: Mailer;
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
 */
export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const {
    users,
    sessions,
    tokens,
    throttle,
    mailer,
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

      if (existing) {
        if (existing.deletedAt === null) {
          try {
            await mailer.send({
              to: existing.email,
              subject: DUPLICATE_NOTICE_SUBJECT,
              text: DUPLICATE_NOTICE_TEXT,
            });
          } catch (error) {
            logger.error("registration notice failed", {
              reason: error instanceof Error ? error.name : "Error",
            });
          }
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
        user: { id: activeUser.id, displayName: activeUser.displayName },
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
  };
}

function deviceUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replaceAll("\u0000", "");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 256);
}
