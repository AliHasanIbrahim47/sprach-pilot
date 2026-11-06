import { Router } from "express";

import { bindRoute, tagRouter } from "../access/route-access.js";

export interface PrometheusMetrics {
  renderPrometheus(): string;
}

export function createMetricsRouter(metrics: PrometheusMetrics): Router {
  const router = tagRouter(Router(), "");

  bindRoute(router, "get", "/metrics", { kind: "public" }, [
    (_req, res) => {
      res
        .status(200)
        .type("text/plain; version=0.0.4; charset=utf-8")
        .send(metrics.renderPrometheus());
    },
  ]);

  return router;
}
