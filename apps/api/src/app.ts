import compression from "compression";
import express, { type Express } from "express";

import type { AppContainer } from "./container.js";
import { requestIdMiddleware } from "./middleware/request-id.js";

export function createApp(container: AppContainer): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(compression());
  app.use(express.json({ limit: container.config.jsonBodyLimit }));
  app.use(container.healthRouter);

  return app;
}
