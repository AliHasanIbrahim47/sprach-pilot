import { prisma } from "@sprachpilot/db";
import { ACCESS_TOKEN_COOKIE } from "@sprachpilot/shared";
import type { Request, RequestHandler, Router } from "express";
import { Redis } from "ioredis";

import type { ApiConfig } from "./config.js";
import {
  createDatabaseHealthCheck,
  createRedisHealthCheck,
} from "./infrastructure/health-checks.js";
import { createConsoleLogger } from "./infrastructure/logger.js";
import { createReadyRedisCommands } from "./infrastructure/ready-redis.js";
import { type AuthController, createAuthController } from "./modules/auth/auth.controller.js";
import { createUserRepository, type UserRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter, createJwksRouter } from "./modules/auth/auth.routes.js";
import { type AuthService, createAuthService } from "./modules/auth/auth.service.js";
import { readRequestCookie } from "./modules/auth/auth-cookies.js";
import { resolveClientIp } from "./modules/auth/client-ip.js";
import {
  createEmailTokenRepository,
  type EmailTokenRepository,
} from "./modules/auth/email-token.repository.js";
import { createEmailTokenCodec } from "./modules/auth/email-token-codec.js";
import { createRedisLoginThrottle, type LoginThrottle } from "./modules/auth/login-throttle.js";
import { type AuthMetrics, createAuthMetrics } from "./modules/auth/metrics.js";
import { createPasswordHasher, type PasswordHasher } from "./modules/auth/password-hasher.js";
import { createRequireAuth } from "./modules/auth/require-auth.js";
import { createRequireVerifiedEmail } from "./modules/auth/require-verified.js";
import {
  createSessionRepository,
  type SessionRepository,
} from "./modules/auth/session.repository.js";
import { createTokenService, type TokenService } from "./modules/auth/token.service.js";
import { createDocsRouter, shouldEnableApiDocs } from "./modules/docs/docs.routes.js";
import { createBullEmailQueue, type EmailQueue } from "./modules/email/email-queue.js";
import {
  createRedisEmailSendLimiter,
  type EmailSendLimiter,
} from "./modules/email/email-rate-limit.js";
import type { HealthController } from "./modules/health/health.controller.js";
import { createHealthController } from "./modules/health/health.controller.js";
import { createHealthRepository } from "./modules/health/health.repository.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import type { DependencyHealthPort } from "./modules/health/health.schemas.js";
import { createHealthService } from "./modules/health/health.service.js";
import { createMetricsRouter } from "./modules/metrics/metrics.routes.js";

export interface AppContainer {
  config: ApiConfig;
  healthController: HealthController;
  healthRouter: Router;
  authController: AuthController;
  authRouter: Router;
  requireAuth: RequestHandler;
  requireVerifiedEmail: RequestHandler;
  jwksRouter: Router;
  metricsRouter: Router;
  docsRouter: Router | undefined;
  close(): Promise<void>;
}

export interface AuthOverrides {
  users?: UserRepository;
  sessions?: SessionRepository;
  tokens?: TokenService;
  throttle?: LoginThrottle;
  emailTokens?: EmailTokenRepository;
  emailSends?: EmailSendLimiter;
  emailQueue?: EmailQueue;
  metrics?: AuthMetrics;
  hasher?: PasswordHasher;
  clock?: () => Date;
}

export interface ContainerOverrides {
  dependencyChecks?: DependencyHealthPort[];
  auth?: AuthOverrides;
}

export function createContainer(
  config: ApiConfig,
  overrides: ContainerOverrides = {},
): AppContainer {
  const dependencyChecks = overrides.dependencyChecks ?? [
    createDatabaseHealthCheck(),
    createRedisHealthCheck(config.redisUrl),
  ];

  const healthRepository = createHealthRepository(dependencyChecks);
  const healthService = createHealthService(healthRepository);
  const healthController = createHealthController(healthService);
  const healthRouter = createHealthRouter(healthController);

  const metrics = overrides.auth?.metrics ?? createAuthMetrics();
  const redisPorts = resolveRedisPorts(overrides.auth, config);
  const tokens =
    overrides.auth?.tokens ??
    createTokenService({
      activeKid: config.jwt.activeKid,
      privateKeyPem: config.jwt.privateKeyPem,
      publicKeys: config.jwt.publicKeys,
      refreshPepper: config.jwt.refreshPepper,
    });
  const users = overrides.auth?.users ?? createUserRepository();
  const emailTransport = resolveEmailQueue(overrides.auth?.emailQueue, config.redisUrl);
  const requireAuth = createRequireAuth(tokens);

  const authService: AuthService = createAuthService({
    users,
    sessions: overrides.auth?.sessions ?? createSessionRepository(),
    tokens,
    throttle: redisPorts.throttle,
    emailTokens: overrides.auth?.emailTokens ?? createEmailTokenRepository(),
    emailCodec: createEmailTokenCodec(config.jwt.refreshPepper),
    emailSends: redisPorts.emailSends,
    emailQueue: emailTransport.emailQueue,
    webPublicUrl: config.webPublicUrl,
    metrics,
    hasher: overrides.auth?.hasher ?? createPasswordHasher(),
    clock: overrides.auth?.clock ?? (() => new Date()),
    ipHashSecret: config.ipHashSecret,
    registrationEnabled: config.features.registrationEnabled,
    logger: createConsoleLogger("auth"),
  });
  const authController = createAuthController(
    authService,
    (req) => resolveClientIp(req, config.internalApiSecret),
    { secure: true, domain: config.cookieDomain },
    () => tokens.publicJwks(),
    (req) => readOptionalUserId(req, tokens),
  );
  const authRouter = createAuthRouter(authController, requireAuth);
  const jwksRouter = createJwksRouter(authController);
  const metricsRouter = createMetricsRouter(metrics);

  const docsRouter = shouldEnableApiDocs({
    nodeEnv: config.nodeEnv,
    enableApiDocs: config.enableApiDocs,
  })
    ? createDocsRouter()
    : undefined;

  return {
    config,
    healthController,
    healthRouter,
    authController,
    authRouter,
    requireAuth,
    requireVerifiedEmail: createRequireVerifiedEmail(users),
    jwksRouter,
    metricsRouter,
    docsRouter,
    async close() {
      await emailTransport.emailQueue.close();
      emailTransport.connection?.disconnect();
      redisPorts.redis?.disconnect();
      await prisma.$disconnect();
    },
  };
}

function resolveEmailQueue(
  override: EmailQueue | undefined,
  redisUrl: string,
): { emailQueue: EmailQueue; connection: Redis | undefined } {
  if (override) return { emailQueue: override, connection: undefined };
  const connection = createQueueConnection(redisUrl);
  return { emailQueue: createBullEmailQueue(connection), connection };
}

function createQueueConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

async function readOptionalUserId(req: Request, tokens: TokenService): Promise<string | undefined> {
  const token = readRequestCookie(req, ACCESS_TOKEN_COOKIE);
  if (!token) return undefined;
  try {
    const claims = await tokens.verifyAccessToken(token);
    return claims.sub;
  } catch {
    return undefined;
  }
}

function resolveRedisPorts(
  auth: AuthOverrides | undefined,
  config: ApiConfig,
): {
  throttle: LoginThrottle;
  emailSends: EmailSendLimiter;
  redis: Redis | undefined;
} {
  const throttleOverride = auth?.throttle;
  const emailSendsOverride = auth?.emailSends;

  if (throttleOverride && emailSendsOverride) {
    return { throttle: throttleOverride, emailSends: emailSendsOverride, redis: undefined };
  }

  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  const commands = createReadyRedisCommands(redis);
  return {
    throttle: throttleOverride ?? createRedisLoginThrottle(commands),
    emailSends:
      emailSendsOverride ?? createRedisEmailSendLimiter(commands, { pepper: config.ipHashSecret }),
    redis,
  };
}
