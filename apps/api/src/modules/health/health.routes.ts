import { Router } from "express";

import type { HealthController } from "./health.controller.js";

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();

  router.get("/healthz", (req, res) => {
    controller.liveness(req, res);
  });

  router.get("/readyz", (req, res, next) => {
    void controller.readiness(req, res).catch(next);
  });

  return router;
}
