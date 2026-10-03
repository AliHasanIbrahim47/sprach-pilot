import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { loginBodySchema, loginSuccessResponseSchema } from "../auth/login.js";
import { AUTH_COPY } from "../auth/messages.js";
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

const problemResponse = {
  description: "Problem Details",
  content: {
    "application/problem+json": {
      schema: problemDetailsSchema,
    },
  },
} as const;

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/register",
  tags: ["Auth"],
  summary: "Register with email and password",
  description:
    "Creates an account and asks the caller to verify their email. The response is the same when the email is already registered; that account receives a notice instead of a second user. Passwords are checked against a bundled common-password list.",
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
    202: {
      description: "Registration accepted. Check email to verify the account.",
      content: {
        "application/json": {
          schema: registerAcceptedResponseSchema,
          example: { status: "accepted", message: AUTH_COPY.registerAccepted },
        },
      },
    },
    400: {
      description: "Validation failed, including a password that is too common",
      content: problemResponse.content,
    },
    403: {
      description: "Registration is disabled",
      content: problemResponse.content,
    },
    500: {
      description: "Unexpected server error",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/login",
  tags: ["Auth"],
  summary: "Log in with email and password",
  description:
    "Verifies credentials. Wrong email and wrong password return the same error. Session tokens are issued in SP-013. After 5 failures in 15 minutes for an email and IP pair, further attempts return 429.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Credentials matched",
      content: {
        "application/json": {
          schema: loginSuccessResponseSchema,
        },
      },
    },
    400: problemResponse,
    401: {
      description: AUTH_COPY.invalidCredentials,
      content: problemResponse.content,
    },
    429: {
      description: "Too many failed attempts for this email and IP",
      headers: {
        "Retry-After": {
          description: "Seconds until another attempt is allowed",
          schema: { type: "integer", minimum: 1 },
        },
      },
      content: problemResponse.content,
    },
    500: {
      description: "Unexpected server error",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/logout",
  tags: ["Auth"],
  summary: "Log out",
  description:
    "Ends the current session. Refresh-token revocation arrives with SP-013; until then this responds 204 and clears no token.",
  responses: {
    204: {
      description: "Logged out",
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
