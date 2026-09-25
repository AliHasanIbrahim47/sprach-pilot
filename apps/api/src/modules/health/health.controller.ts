import type { Request, Response } from "express";

import type { HealthService } from "./health.service.js";

export interface HealthController {
  liveness(_req: Request, res: Response): void;
  readiness(req: Request, res: Response): Promise<void>;
}

export function createHealthController(service: HealthService): HealthController {
  return {
    liveness(_req, res) {
      res.status(200).json(service.getLiveness());
    },

    async readiness(_req, res) {
      const body = await service.getReadiness();
      const statusCode = body.status === "ok" ? 200 : 503;
      res.status(statusCode).json(body);
    },
  };
}
