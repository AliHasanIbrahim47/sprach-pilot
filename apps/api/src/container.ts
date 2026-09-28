import type { Router } from "express";

import type { ApiConfig } from "./config.js";
import {
  createDatabaseHealthCheck,
  createRedisHealthCheck,
} from "./infrastructure/health-checks.js";
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

  return {
    config,
    healthController,
    healthRouter,
  };
}
