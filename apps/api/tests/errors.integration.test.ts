import { Prisma } from "@sprachpilot/db";
import {
  createCursorPage,
  cursorPaginationQuerySchema,
  MAX_PAGE_LIMIT,
  NotFoundError,
} from "@sprachpilot/shared";
import type { Router } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { mapPrismaError } from "../src/infrastructure/prisma-errors.js";
import { REQUEST_ID_HEADER } from "../src/middleware/request-id.js";
import { validateQuery } from "../src/middleware/validate.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

function createTestApp(env: NodeJS.ProcessEnv = {}, registerV1?: (v1: Router) => void) {
  const config = loadConfig(createValidApiEnv({ NODE_ENV: "test", PORT: "0", ...env }));
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth: { throttle: createMemoryLoginThrottle(), ...createTestEmailPorts() },
  });
  return createApp(container, { registerV1 });
}

describe("error handling (SP-009)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 problem+json for a non-existent resource", async () => {
    const app = createTestApp();

    const response = await request(app).get("/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://sprachpilot.app/errors/not-found",
      title: "Not Found",
      status: 404,
    });
    expect(response.body.requestId).toBeTruthy();
    expect(response.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("returns 404 when a handler throws NotFoundError", async () => {
    const app = createTestApp({}, (v1) => {
      v1.get("/widgets/:id", (_req, _res, next) => {
        next(new NotFoundError("Widget not found"));
      });
    });

    const response = await request(app).get("/v1/widgets/missing");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://sprachpilot.app/errors/not-found",
      status: 404,
      detail: "Widget not found",
    });
  });

  it("hides unexpected error details in production and logs stack with request id", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createTestApp({ NODE_ENV: "production" }, (v1) => {
      v1.get("/boom", () => {
        throw new Error("secret sql dump");
      });
    });

    const response = await request(app).get("/v1/boom").set(REQUEST_ID_HEADER, "req-prod-1");

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://sprachpilot.app/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
      requestId: "req-prod-1",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret sql dump");

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).toContain("req-prod-1");
    expect(logged).toMatch(/secret sql dump|Error: secret sql dump/);
  });

  it("includes exception message in non-production 500 detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createTestApp({ NODE_ENV: "test" }, (v1) => {
      v1.get("/boom", () => {
        throw new Error("dev-only detail");
      });
    });

    const response = await request(app).get("/v1/boom");

    expect(response.status).toBe(500);
    expect(response.body.detail).toBe("dev-only detail");
  });

  it("sets API-Version on /v1 responses", async () => {
    const app = createTestApp();
    const response = await request(app).get("/v1/does-not-exist");
    expect(response.get("API-Version")).toBe("1");
  });
});

describe("Prisma error mapping (SP-009)", () => {
  it("maps P2002 to ConflictError (409)", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["email"] },
    });

    const mapped = mapPrismaError(error);
    expect(mapped?.status).toBe(409);
    expect(mapped?.code).toBe("conflict");
    expect(mapped?.detail).toMatch(/email/i);
  });

  it("maps P2025 to NotFoundError (404)", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });

    const mapped = mapPrismaError(error);
    expect(mapped?.status).toBe(404);
    expect(mapped?.code).toBe("not-found");
  });

  it("returns 409 problem+json when a handler throws Prisma P2002", async () => {
    const app = createTestApp({}, (v1) => {
      v1.post("/force-conflict", (_req, _res, next) => {
        next(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["email"] },
          }),
        );
      });
    });

    const response = await request(app).post("/v1/force-conflict");

    expect(response.status).toBe(409);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://sprachpilot.app/errors/conflict",
      status: 409,
    });
  });
});

describe("cursor pagination (SP-009)", () => {
  it("clamps limit=500 to 100 on a list endpoint", async () => {
    const app = createTestApp({}, (v1) => {
      v1.get("/items", validateQuery(cursorPaginationQuerySchema), (req, res) => {
        const { cursor, limit } = req.query as {
          cursor?: string;
          limit: number;
        };
        const start = cursor ? Number.parseInt(cursor, 10) + 1 : 0;
        const fetched = Array.from({ length: limit + 1 }, (_, index) => ({
          id: String(start + index),
        }));
        res.json(createCursorPage({ items: fetched, limit, getCursor: (item) => item.id }));
      });
    });

    const response = await request(app).get("/v1/items").query({ limit: 500 });

    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(MAX_PAGE_LIMIT);
    expect(response.body.items).toHaveLength(MAX_PAGE_LIMIT);
    expect(response.body.nextCursor).toBe(String(MAX_PAGE_LIMIT - 1));
  });

  it("parses default limit when omitted", () => {
    const parsed = cursorPaginationQuerySchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.cursor).toBeUndefined();
  });
});
