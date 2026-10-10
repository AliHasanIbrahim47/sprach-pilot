import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  accountResponseSchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  passwordResetResponseSchema,
  resendVerificationBodySchema,
  verifyEmailQuerySchema,
  verifyEmailResponseSchema,
} from "../auth/email-flows.js";
import { loginBodySchema, loginSuccessResponseSchema } from "../auth/login.js";
import { AUTH_COPY } from "../auth/messages.js";
import { registerAcceptedResponseSchema, registerBodySchema } from "../auth/register.js";
import { refreshSuccessResponseSchema, sessionListResponseSchema } from "../auth/sessions.js";
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
    "Verifies credentials. Wrong email and wrong password return the same error. A successful login sets httpOnly access and refresh cookies and does not return token strings. After 5 failures in 15 minutes for an email and IP pair, further attempts return 429.",
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
    "Revokes the current session family and clears the access and refresh cookies. The response is 204 even when no session cookie was sent.",
  responses: {
    204: {
      description: "Logged out",
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/refresh",
  tags: ["Auth"],
  summary: "Rotate the refresh token",
  description:
    "Reads the refresh cookie, issues a new access token and refresh token, and invalidates the presented refresh token. Presenting a refresh token that was already rotated revokes the whole session family and returns 401.",
  responses: {
    200: {
      description: "Cookies rotated. The body does not contain token strings.",
      content: {
        "application/json": {
          schema: refreshSuccessResponseSchema,
          example: { status: "refreshed" },
        },
      },
    },
    401: {
      description: "Missing, expired, revoked, or reused refresh token",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/v1/auth/sessions",
  tags: ["Auth"],
  summary: "List active sessions",
  description: "Returns the caller's live device sessions. Requires a valid access-token cookie.",
  responses: {
    200: {
      description: "Active sessions",
      content: {
        "application/json": {
          schema: sessionListResponseSchema,
        },
      },
    },
    401: {
      description: "Missing or expired access token",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/v1/auth/sessions/{id}",
  tags: ["Auth"],
  summary: "Revoke a session",
  description:
    "Revokes one device session family. The other device is rejected at its next refresh. Requires a valid access-token cookie.",
  request: {
    params: z.object({
      id: z.string().min(1).max(64).meta({ description: "Session family id" }),
    }),
  },
  responses: {
    204: {
      description: "Session revoked",
    },
    401: {
      description: "Missing or expired access token",
      content: problemResponse.content,
    },
    404: {
      description: "No session with that id belongs to the caller",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/v1/auth/verify",
  tags: ["Auth"],
  summary: "Verify an email address",
  description:
    "Consumes a single-use verification token. A token that was already used returns 409. Expired and unknown tokens return 400. The raw token is not stored.",
  request: {
    query: verifyEmailQuerySchema,
  },
  responses: {
    200: {
      description: "Email verified",
      content: {
        "application/json": {
          schema: verifyEmailResponseSchema,
          example: { status: "verified", message: AUTH_COPY.emailVerified },
        },
      },
    },
    400: {
      description: "Token is missing, expired, or invalid",
      content: problemResponse.content,
    },
    409: {
      description: AUTH_COPY.linkAlreadyUsed,
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/verify/resend",
  tags: ["Auth"],
  summary: "Resend a verification email",
  description:
    "Queues another verification email when the account exists and is unverified, up to 3 per address per hour. The response does not reveal whether the email exists, is already verified, or was rate limited. A session cookie selects the signed-in account.",
  request: {
    body: {
      content: { "application/json": { schema: resendVerificationBodySchema } },
      required: true,
    },
  },
  responses: {
    202: {
      description: "Request accepted",
      content: {
        "application/json": {
          schema: registerAcceptedResponseSchema,
          example: { status: "accepted", message: AUTH_COPY.verificationResent },
        },
      },
    },
    400: problemResponse,
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/password/forgot",
  tags: ["Auth"],
  summary: "Request a password reset",
  description:
    "Always returns the same confirmation. A reset email is queued only when the account exists and the address is under the hourly limit of 3.",
  request: {
    body: {
      content: { "application/json": { schema: passwordForgotBodySchema } },
      required: true,
    },
  },
  responses: {
    202: {
      description: "Request accepted",
      content: {
        "application/json": {
          schema: registerAcceptedResponseSchema,
          example: { status: "accepted", message: AUTH_COPY.passwordResetAccepted },
        },
      },
    },
    400: problemResponse,
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/v1/auth/password/reset",
  tags: ["Auth"],
  summary: "Choose a new password",
  description:
    "Consumes a single-use reset token, stores a new password hash, and revokes every existing session for that user.",
  request: {
    body: {
      content: { "application/json": { schema: passwordResetBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Password updated and sessions revoked",
      content: {
        "application/json": {
          schema: passwordResetResponseSchema,
          example: { status: "reset", message: AUTH_COPY.passwordResetComplete },
        },
      },
    },
    400: {
      description: "Token is invalid or expired, or the password is too common",
      content: problemResponse.content,
    },
    409: {
      description: AUTH_COPY.linkAlreadyUsed,
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/v1/auth/me",
  tags: ["Auth"],
  summary: "Current account",
  description: "Returns the signed-in account, including whether the email is verified.",
  responses: {
    200: {
      description: "Current account",
      content: {
        "application/json": {
          schema: accountResponseSchema,
        },
      },
    },
    401: {
      description: "Missing or expired access token",
      content: problemResponse.content,
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/.well-known/jwks.json",
  tags: ["Auth"],
  summary: "JSON Web Key Set",
  description:
    "Public Ed25519 keys used to verify access tokens. Multiple keys can be published during rotation; each access token carries a kid.",
  responses: {
    200: {
      description: "Public keys",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["keys"],
            properties: {
              keys: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
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
