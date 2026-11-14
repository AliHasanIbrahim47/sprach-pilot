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
import { createRoleController } from "./modules/access/role.controller.js";
import { createRoleRepository, type RoleRepository } from "./modules/access/role.repository.js";
import { createAdminRouter } from "./modules/access/role.routes.js";
import { createRoleService } from "./modules/access/role.service.js";
import {
  type AccountRepository,
  createAccountRepository,
} from "./modules/auth/account.repository.js";
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
import {
  createGoogleOAuthProvider,
  type GoogleOAuthProvider,
} from "./modules/auth/google-oauth.provider.js";
import { createRedisLoginThrottle, type LoginThrottle } from "./modules/auth/login-throttle.js";
import { type AuthMetrics, createAuthMetrics } from "./modules/auth/metrics.js";
import { createOAuthService, type OAuthService } from "./modules/auth/oauth.service.js";
import {
  createMemoryOAuthStateStore,
  createRedisOAuthStateStore,
  type OAuthStateStore,
} from "./modules/auth/oauth-state.store.js";
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
import { createOnboardingMetrics, type OnboardingMetrics } from "./modules/onboarding/metrics.js";
import {
  createOnboardingController,
  type OnboardingController,
} from "./modules/onboarding/onboarding.controller.js";
import {
  createOnboardingRepository,
  type OnboardingRepository,
} from "./modules/onboarding/onboarding.repository.js";
import { createOnboardingRouter } from "./modules/onboarding/onboarding.routes.js";
import { createOnboardingService } from "./modules/onboarding/onboarding.service.js";
import {
  createBullGdprQueue,
  createMemoryGdprQueue,
  type GdprQueue,
} from "./modules/privacy/gdpr-queue.js";
import {
  createPrivacyController,
  type PrivacyController,
} from "./modules/privacy/privacy.controller.js";
import { createPrivacyMetrics, type PrivacyMetrics } from "./modules/privacy/privacy.metrics.js";
import { createPrivacyRouter } from "./modules/privacy/privacy.routes.js";
import { createPrivacyService, type PrivacyService } from "./modules/privacy/privacy.service.js";
import {
  createMemoryPrivacyStore,
  createPrismaPrivacyStore,
  type PrivacyStore,
} from "./modules/privacy/privacy.store.js";
import {
  assertPrivacyDomains,
  BUILTIN_PRIVACY_DOMAINS,
} from "./modules/privacy/privacy-registry.js";
import {
  type AvatarQueue,
  createBullAvatarQueue,
  createMemoryAvatarQueue,
} from "./modules/settings/avatar-queue.js";
import {
  createMemoryObjectStorage,
  createS3ObjectStorage,
  type ObjectStorage,
} from "./modules/settings/object-storage.js";
import {
  createSettingsController,
  type SettingsController,
} from "./modules/settings/settings.controller.js";
import { createSettingsMetrics } from "./modules/settings/settings.metrics.js";
import {
  createSettingsRepository,
  type SettingsRepository,
} from "./modules/settings/settings.repository.js";
import { createSettingsRouter } from "./modules/settings/settings.routes.js";
import { createSettingsService } from "./modules/settings/settings.service.js";

export interface AppContainer {
  config: ApiConfig;
  healthController: HealthController;
  healthRouter: Router;
  authController: AuthController;
  authRouter: Router;
  adminRouter: Router;
  onboardingRouter: Router;
  onboardingController: OnboardingController;
  settingsRouter: Router;
  settingsController: SettingsController;
  privacyRouter: Router;
  privacyController: PrivacyController;
  processPrivacyJobs(): Promise<void>;
  requireAuth: RequestHandler;
  requireVerifiedEmail: RequestHandler;
  jwksRouter: Router;
  metricsRouter: Router;
  docsRouter: Router | undefined;
  close(): Promise<void>;
}

export interface AuthOverrides {
  users?: UserRepository;
  accounts?: AccountRepository;
  sessions?: SessionRepository;
  tokens?: TokenService;
  throttle?: LoginThrottle;
  emailTokens?: EmailTokenRepository;
  emailSends?: EmailSendLimiter;
  emailQueue?: EmailQueue;
  metrics?: AuthMetrics;
  hasher?: PasswordHasher;
  clock?: () => Date;
  oauthState?: OAuthStateStore;
  googleOAuth?: GoogleOAuthProvider | null;
  roles?: RoleRepository;
}

export interface OnboardingOverrides {
  profiles?: OnboardingRepository;
  metrics?: OnboardingMetrics;
  clock?: () => Date;
}

export interface SettingsOverrides {
  store?: SettingsRepository;
  storage?: ObjectStorage;
  avatars?: AvatarQueue;
  clock?: () => Date;
}

export interface PrivacyOverrides {
  store?: PrivacyStore;
  queue?: GdprQueue;
  metrics?: PrivacyMetrics;
  clock?: () => Date;
}

export interface ContainerOverrides {
  dependencyChecks?: DependencyHealthPort[];
  auth?: AuthOverrides;
  onboarding?: OnboardingOverrides;
  settings?: SettingsOverrides;
  privacy?: PrivacyOverrides;
}

/**
 * Builds the process object graph, including onboarding and the combined metrics output.
 */
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
  const onboardingMetrics = overrides.onboarding?.metrics ?? createOnboardingMetrics();
  const privacyMetrics = overrides.privacy?.metrics ?? createPrivacyMetrics();
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
  const accounts = overrides.auth?.accounts ?? createAccountRepository();
  const sessions = overrides.auth?.sessions ?? createSessionRepository();
  const hasher = overrides.auth?.hasher ?? createPasswordHasher();
  const clock = overrides.auth?.clock ?? (() => new Date());
  const emailTransport = resolveEmailQueue(overrides.auth?.emailQueue, config.redisUrl);
  const emailTokens = overrides.auth?.emailTokens ?? createEmailTokenRepository();
  const emailCodec = createEmailTokenCodec(config.jwt.refreshPepper);
  const requireAuth = createRequireAuth(tokens);
  const authLogger = createConsoleLogger("auth");
  const useMemoryPorts = overrides.auth?.emailQueue !== undefined;
  const avatarTransport = resolveAvatarQueue(
    overrides.settings?.avatars,
    useMemoryPorts,
    config.redisUrl,
  );
  const storage =
    overrides.settings?.storage ??
    (useMemoryPorts ? createMemoryObjectStorage() : createS3ObjectStorage(config));

  const authService: AuthService = createAuthService({
    users,
    accounts,
    sessions,
    tokens,
    throttle: redisPorts.throttle,
    emailTokens,
    emailCodec,
    emailSends: redisPorts.emailSends,
    emailQueue: emailTransport.emailQueue,
    webPublicUrl: config.webPublicUrl,
    metrics,
    hasher,
    clock,
    ipHashSecret: config.ipHashSecret,
    registrationEnabled: config.features.registrationEnabled,
    logger: authLogger,
    onDeletionCancelled() {
      privacyMetrics.recordDeletion("cancelled");
    },
  });

  const googleCredentials = config.oauth.google;
  const googleOAuth =
    overrides.auth?.googleOAuth !== undefined
      ? overrides.auth.googleOAuth
      : googleCredentials
        ? createGoogleOAuthProvider(googleCredentials)
        : null;

  const oauthService: OAuthService = createOAuthService({
    enabled: config.features.googleOAuthEnabled,
    redirectUri: googleCredentials?.redirectUri ?? null,
    google: googleOAuth,
    users,
    accounts,
    sessions,
    tokens,
    oauthState: redisPorts.oauthState,
    hasher,
    metrics,
    clock,
    ipHashSecret: config.ipHashSecret,
    logger: authLogger,
  });

  const authController = createAuthController(
    authService,
    oauthService,
    (req) => resolveClientIp(req, config.internalApiSecret),
    { secure: true, domain: config.cookieDomain },
    () => tokens.publicJwks(),
    (req) => readOptionalUserId(req, tokens),
  );
  const authRouter = createAuthRouter(authController, requireAuth);
  const adminRouter = createAdminRouter(
    createRoleController(createRoleService(overrides.auth?.roles ?? createRoleRepository())),
    requireAuth,
  );
  const jwksRouter = createJwksRouter(authController);
  const onboardingController = createOnboardingController(
    createOnboardingService({
      profiles: overrides.onboarding?.profiles ?? createOnboardingRepository(),
      metrics: onboardingMetrics,
      clock: overrides.onboarding?.clock ?? clock,
    }),
  );
  const onboardingRouter = createOnboardingRouter(onboardingController, requireAuth);
  const settingsMetrics = createSettingsMetrics();
  const settingsStore = overrides.settings?.store ?? createSettingsRepository();
  const settingsController = createSettingsController(
    createSettingsService({
      users,
      sessions,
      store: settingsStore,
      hasher,
      emailTokens,
      emailCodec,
      emailSends: redisPorts.emailSends,
      emailQueue: emailTransport.emailQueue,
      storage,
      avatars: avatarTransport.queue,
      webPublicUrl: config.webPublicUrl,
      clock: overrides.settings?.clock ?? clock,
      logger: createConsoleLogger("settings"),
    }),
    settingsMetrics,
  );
  const settingsRouter = createSettingsRouter(settingsController, requireAuth);
  assertPrivacyDomains(BUILTIN_PRIVACY_DOMAINS);
  const privacyClock = overrides.privacy?.clock ?? overrides.settings?.clock ?? clock;
  const privacyStore =
    overrides.privacy?.store ??
    (useMemoryPorts ? createMemoryPrivacyStore() : createPrismaPrivacyStore(prisma));
  const gdprTransport = resolveGdprQueue(overrides.privacy?.queue, useMemoryPorts, config.redisUrl);
  const privacyService: PrivacyService = createPrivacyService({
    users,
    accounts,
    sessions,
    settings: settingsStore,
    store: privacyStore,
    storage,
    emailQueue: emailTransport.emailQueue,
    gdprQueue: gdprTransport.queue,
    metrics: privacyMetrics,
    clock: privacyClock,
    ipHashSecret: config.ipHashSecret,
    webPublicUrl: config.webPublicUrl,
  });
  const privacyController = createPrivacyController(
    privacyService,
    (req) => resolveClientIp(req, config.internalApiSecret),
    { secure: true, domain: config.cookieDomain },
  );
  const privacyRouter = createPrivacyRouter(privacyController, requireAuth);
  const metricsRouter = createMetricsRouter({
    renderPrometheus() {
      return `${metrics.renderPrometheus()}${onboardingMetrics.renderPrometheus()}${settingsMetrics.renderPrometheus()}${privacyMetrics.renderPrometheus()}`;
    },
  });

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
    adminRouter,
    onboardingRouter,
    onboardingController,
    settingsRouter,
    settingsController,
    privacyRouter,
    privacyController,
    processPrivacyJobs() {
      return privacyService.processExports().then(() => privacyService.processDuePurges());
    },
    requireAuth,
    requireVerifiedEmail: createRequireVerifiedEmail(users),
    jwksRouter,
    metricsRouter,
    docsRouter,
    async close() {
      await emailTransport.emailQueue.close();
      emailTransport.connection?.disconnect();
      await avatarTransport.queue.close();
      avatarTransport.connection?.disconnect();
      await gdprTransport.queue.close();
      gdprTransport.connection?.disconnect();
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

function resolveAvatarQueue(
  override: AvatarQueue | undefined,
  memory: boolean,
  redisUrl: string,
): { queue: AvatarQueue; connection: Redis | undefined } {
  if (override) return { queue: override, connection: undefined };
  if (memory) return { queue: createMemoryAvatarQueue(), connection: undefined };
  const connection = createQueueConnection(redisUrl);
  return { queue: createBullAvatarQueue(connection), connection };
}

function resolveGdprQueue(
  override: GdprQueue | undefined,
  memory: boolean,
  redisUrl: string,
): { queue: GdprQueue; connection: Redis | undefined } {
  if (override) return { queue: override, connection: undefined };
  if (memory) return { queue: createMemoryGdprQueue(), connection: undefined };
  const connection = createQueueConnection(redisUrl);
  return { queue: createBullGdprQueue(connection), connection };
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
  oauthState: OAuthStateStore;
  redis: Redis | undefined;
} {
  const throttleOverride = auth?.throttle;
  const emailSendsOverride = auth?.emailSends;
  const oauthStateOverride = auth?.oauthState;

  // Tests inject throttle + email limiter and skip Redis. Default OAuth state to memory.
  if (throttleOverride && emailSendsOverride) {
    return {
      throttle: throttleOverride,
      emailSends: emailSendsOverride,
      oauthState: oauthStateOverride ?? createMemoryOAuthStateStore(),
      redis: undefined,
    };
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
    oauthState: oauthStateOverride ?? createRedisOAuthStateStore(commands),
    redis,
  };
}

/** Exposed for tests that need an in-memory OAuth state without Redis. */
export { createMemoryOAuthStateStore };
