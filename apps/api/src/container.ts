import type { Router } from "express";

import type { ApiConfig } from "./config.js";
import {
  createDatabaseHealthCheck,
  createRedisHealthCheck,
} from "./infrastructure/health-checks.js";
import { type AuthController, createAuthController } from "./modules/auth/auth.controller.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createDocsRouter, shouldEnableApiDocs } from "./modules/docs/docs.routes.js";
import type { HealthController } from "./modules/health/health.controller.js";
import { createHealthController } from "./modules/health/health.controller.js";
import { createHealthRepository } from "./modules/health/health.repository.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import type { DependencyHealthPort } from "./modules/health/health.schemas.js";
import { createHealthService } from "./modules/health/health.service.js";

export interface AppContainer {
  config: ApiConfig;
  healthController: HealthController;
  healthRouter: Router;
  authController: AuthController;
  authRouter: Router;
  docsRouter: Router | undefined;
}

export interface ContainerOverrides {
  dependencyChecks?: DependencyHealthPort[];
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

  const authController = createAuthController();
  const authRouter = createAuthRouter(authController);

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
    docsRouter,
  };
}
