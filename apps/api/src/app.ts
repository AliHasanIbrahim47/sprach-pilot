import compression from "compression";
import express, { type Express, Router } from "express";

import type { AppContainer } from "./container.js";
import { requestIdMiddleware } from "./middleware/request-id.js";

export function createApp(container: AppContainer): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(compression());
  app.use(express.json({ limit: container.config.jsonBodyLimit }));
  app.use(container.healthRouter);

  const v1 = Router();
  v1.use("/auth", container.authRouter);
  app.use("/v1", v1);

  if (container.docsRouter) {
    app.use(container.docsRouter);
  }

  return app;
}
