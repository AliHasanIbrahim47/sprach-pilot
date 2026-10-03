import {
  AUTH_COPY,
  ForbiddenError,
  type LoginBody,
  type LoginSuccessResponse,
  RateLimitedError,
  type RegisterAcceptedResponse,
  type RegisterBody,
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
}

export interface AuthService {
  register(input: RegisterBody, context: AuthRequestContext): Promise<RegisterAcceptedResponse>;
  login(input: LoginBody, context: AuthRequestContext): Promise<LoginSuccessResponse>;
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
 */
export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const { users, throttle, mailer, metrics, hasher, clock, ipHashSecret, logger } = dependencies;

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
      return {
        status: "authenticated",
        user: { id: activeUser.id, displayName: activeUser.displayName },
      };
    },
  };
}
