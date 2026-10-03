import { Router } from "express";

import type { AuthMetrics } from "../auth/metrics.js";

export function createMetricsRouter(metrics: AuthMetrics): Router {
  const router = Router();

  router.get("/metrics", (_req, res) => {
    res
      .status(200)
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(metrics.renderPrometheus());
  });

  return router;
}
