import { prisma } from "@sprachpilot/db";
import type { Router } from "express";
import { Redis } from "ioredis";

import type { ApiConfig } from "./config.js";
import {
  createDatabaseHealthCheck,
  createRedisHealthCheck,
} from "./infrastructure/health-checks.js";
import { createConsoleLogger } from "./infrastructure/logger.js";
import { type AuthController, createAuthController } from "./modules/auth/auth.controller.js";
import { createUserRepository, type UserRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter, createJwksRouter } from "./modules/auth/auth.routes.js";
import { type AuthService, createAuthService } from "./modules/auth/auth.service.js";
import { resolveClientIp } from "./modules/auth/client-ip.js";
import { createRedisLoginThrottle, type LoginThrottle } from "./modules/auth/login-throttle.js";
import { createSmtpMailer, type Mailer } from "./modules/auth/mailer.js";
import { type AuthMetrics, createAuthMetrics } from "./modules/auth/metrics.js";
import { createPasswordHasher, type PasswordHasher } from "./modules/auth/password-hasher.js";
import { createRequireAuth } from "./modules/auth/require-auth.js";
import {
  createSessionRepository,
  type SessionRepository,
} from "./modules/auth/session.repository.js";
import { createTokenService, type TokenService } from "./modules/auth/token.service.js";
import { createDocsRouter, shouldEnableApiDocs } from "./modules/docs/docs.routes.js";
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
  mailer?: Mailer;
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
  const loginThrottle = resolveLoginThrottle(overrides.auth?.throttle, config.redisUrl);
  const tokens =
    overrides.auth?.tokens ??
    createTokenService({
      activeKid: config.jwt.activeKid,
      privateKeyPem: config.jwt.privateKeyPem,
      publicKeys: config.jwt.publicKeys,
      refreshPepper: config.jwt.refreshPepper,
    });

  const authService: AuthService = createAuthService({
    users: overrides.auth?.users ?? createUserRepository(),
    sessions: overrides.auth?.sessions ?? createSessionRepository(),
    tokens,
    throttle: loginThrottle.throttle,
    mailer: overrides.auth?.mailer ?? createSmtpMailer(config.smtp),
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
  );
  const authRouter = createAuthRouter(authController, createRequireAuth(tokens));
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
    jwksRouter,
    metricsRouter,
    docsRouter,
    async close() {
      loginThrottle.redis?.disconnect();
      await prisma.$disconnect();
    },
  };
}

function resolveLoginThrottle(
  override: LoginThrottle | undefined,
  redisUrl: string,
): { throttle: LoginThrottle; redis: Redis | undefined } {
  if (override) return { throttle: override, redis: undefined };

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  return { throttle: createRedisLoginThrottle(redis), redis };
}
