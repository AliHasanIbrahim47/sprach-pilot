import compression from "compression";
import express, { type Express, type Router as ExpressRouter, Router } from "express";

import type { AppContainer } from "./container.js";
import { createConsoleLogger } from "./infrastructure/logger.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { tagRouter } from "./modules/access/route-access.js";

export type CreateAppOptions = {
  /** Extra routers mounted under `/v1` (used by contract tests). */
  registerV1?: (v1: ExpressRouter) => void;
};

/**
 * Builds the Express app, including the onboarding routes, without opening a port.
 */
export function createApp(container: AppContainer, options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createConsoleLogger("api");

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(compression());
  app.use(express.json({ limit: container.config.jsonBodyLimit }));
  app.use(container.healthRouter);
  app.use(container.jwksRouter);

  const v1 = tagRouter(Router(), "/v1");
  v1.use((_req, res, next) => {
    res.setHeader("API-Version", "1");
    next();
  });
  v1.use("/auth", container.authRouter);
  v1.use(container.adminRouter);
  v1.use(container.onboardingRouter);
  v1.use(container.settingsRouter);
  v1.use(container.privacyRouter);
  options.registerV1?.(v1);
  app.use("/v1", v1);
  app.use(container.metricsRouter);

  if (container.docsRouter) {
    app.use(container.docsRouter);
  }

  app.use(notFoundHandler);
  app.use(
    createErrorHandler({
      nodeEnv: container.config.nodeEnv,
      logger,
    }),
  );

  return app;
}
