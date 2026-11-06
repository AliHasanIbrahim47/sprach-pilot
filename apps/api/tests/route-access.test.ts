import express, { Router } from "express";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import {
  bindMount,
  bindRoute,
  listAppRoutes,
  tagRouter,
  undeclaredRoutes,
} from "../src/modules/access/route-access.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

function createTestApp() {
  const email = createTestEmailPorts();
  const config = loadConfig(createValidApiEnv({ IP_HASH_SECRET: "integration-ip-hash-secret" }));
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth: {
      users: createMemoryUserRepository(),
      sessions: createMemorySessionRepository(),
      throttle: createMemoryLoginThrottle(),
      metrics: createAuthMetrics(),
      emailTokens: email.emailTokens,
      emailSends: email.emailSends,
      emailQueue: email.emailQueue,
    },
  });
  return createApp(container);
}

describe("route access declarations", () => {
  it("declares every mounted route as public or one permission", () => {
    const app = createTestApp();
    expect(undeclaredRoutes(app)).toEqual([]);
    expect(
      listAppRoutes(app)
        .map((route) => `${route.method} ${route.path} ${label(route)}`)
        .sort(),
    ).toEqual(
      [
        "DELETE /v1/auth/oauth/google permission:learn",
        "DELETE /v1/auth/sessions/:id permission:learn",
        "ALL /docs public",
        "GET /.well-known/jwks.json public",
        "GET /healthz public",
        "GET /metrics public",
        "GET /openapi.json public",
        "GET /readyz public",
        "GET /v1/cities permission:learn",
        "GET /v1/auth/me permission:learn",
        "GET /v1/onboarding permission:learn",
        "GET /v1/onboarding/quiz permission:learn",
        "GET /v1/auth/oauth/google public",
        "GET /v1/auth/sessions permission:learn",
        "GET /v1/auth/verify public",
        "PATCH /v1/admin/users/:userId permission:roles.assign",
        "PATCH /v1/onboarding permission:learn",
        "POST /v1/auth/login public",
        "POST /v1/onboarding/complete permission:learn",
        "POST /v1/onboarding/quiz permission:learn",
        "POST /v1/onboarding/skip permission:learn",
        "POST /v1/auth/logout public",
        "POST /v1/auth/oauth/google/callback public",
        "POST /v1/auth/oauth/google/link public",
        "POST /v1/auth/password/forgot public",
        "POST /v1/auth/password/reset public",
        "POST /v1/auth/refresh public",
        "POST /v1/auth/register public",
        "POST /v1/auth/verify/resend public",
      ].sort(),
    );
  });

  it("fails when a route has no access declaration", () => {
    const app = express();
    const router = tagRouter(Router(), "");
    router.get("/undeclared", (_req, res) => {
      res.status(204).end();
    });
    app.use(router);

    expect(undeclaredRoutes(app)).toEqual(["GET /undeclared"]);

    const declared = tagRouter(Router(), "");
    bindRoute(declared, "get", "/declared", { kind: "public" }, [
      (_req, res) => {
        res.status(204).end();
      },
    ]);
    const checked = express();
    checked.use(declared);
    expect(undeclaredRoutes(checked)).toEqual([]);

    const hidden = tagRouter(Router(), "");
    hidden.use("/hidden", (_req, res) => {
      res.status(204).end();
    });
    const hiddenApp = express();
    hiddenApp.use(hidden);
    expect(undeclaredRoutes(hiddenApp)).toEqual(["ALL /hidden"]);

    const mounted = tagRouter(Router(), "");
    bindMount(mounted, "/docs", { kind: "public" }, (_req, res) => {
      res.status(204).end();
    });
    const mountedApp = express();
    mountedApp.use(mounted);
    expect(undeclaredRoutes(mountedApp)).toEqual([]);
  });
});

function label(route: { access: { kind: string; permission?: string } }): string {
  if (route.access.kind === "permission") return `permission:${route.access.permission}`;
  return "public";
}
