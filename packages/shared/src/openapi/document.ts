import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerAcceptedResponseSchema, registerBodySchema } from "../auth/register.js";
import { problemDetailsSchema } from "../errors/problem-details.js";
import { livenessResponseSchema, readinessResponseSchema } from "../health.js";

/**
 * OpenAPI 3.1 document built from Zod `.meta({ id })` annotations (Zod 4).
 * Schema modules stay free of `@asteasolutions/zod-to-openapi` for browser bundling.
 */
export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerPath({
  method: "get",
  path: "/healthz",
  tags: ["Health"],
  summary: "Liveness probe",
  description: "Returns 200 when the process is running.",
  responses: {
    200: {
      description: "Process is alive",
      content: {
        "application/json": {
          schema: livenessResponseSchema,
          example: { status: "ok" },
        },
      },
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/readyz",
  tags: ["Health"],
  summary: "Readiness probe",
  description: "Checks database and Redis. Returns 503 when a dependency is down.",
  responses: {
    200: {
      description: "All dependencies are healthy",
      content: {
        "application/json": {
          schema: readinessResponseSchema,
        },
      },
    },
    503: {
      description: "One or more dependencies are unhealthy",
      content: {
        "application/json": {
          schema: readinessResponseSchema,
        },
      },
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/register",
  tags: ["Auth"],
  summary: "Register with email and password",
  description:
    "Validates registration payload. Full account creation lands in SP-012; valid requests currently return 501.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    400: {
      description: "Validation failed",
      content: {
        "application/problem+json": {
          schema: problemDetailsSchema,
        },
      },
    },
    404: {
      description: "Not found (shared Problem Details catalogue)",
      content: {
        "application/problem+json": {
          schema: problemDetailsSchema,
        },
      },
    },
    409: {
      description: "Conflict (e.g. unique constraint)",
      content: {
        "application/problem+json": {
          schema: problemDetailsSchema,
        },
      },
    },
    500: {
      description: "Unexpected server error",
      content: {
        "application/problem+json": {
          schema: problemDetailsSchema,
        },
      },
    },
    501: {
      description: "Validated but not implemented yet (SP-012)",
      content: {
        "application/json": {
          schema: registerAcceptedResponseSchema,
        },
      },
    },
  },
});

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31["generateDocument"]> {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "SprachPilot API",
      version: "0.1.0",
      description: "Shared Zod contracts drive validation and this OpenAPI document (SP-006).",
    },
    servers: [{ url: "http://localhost:3001", description: "Local API" }],
  });
}
