import { Router } from "express";

import { bindRoute, tagRouter } from "../access/route-access.js";
import type { HealthController } from "./health.controller.js";

const isPublic = { kind: "public" } as const;

export function createHealthRouter(controller: HealthController): Router {
  const router = tagRouter(Router(), "");

  bindRoute(router, "get", "/healthz", isPublic, [
    (req, res) => {
      controller.liveness(req, res);
    },
  ]);

  bindRoute(router, "get", "/readyz", isPublic, [
    (req, res, next) => {
      void controller.readiness(req, res).catch(next);
    },
  ]);

  return router;
}
