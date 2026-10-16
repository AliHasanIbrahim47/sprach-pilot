import {
  loginBodySchema,
  oauthGoogleCallbackBodySchema,
  oauthGoogleLinkBodySchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  registerBodySchema,
  resendVerificationBodySchema,
  verifyEmailQuerySchema,
} from "@sprachpilot/shared";
import { type RequestHandler, Router } from "express";

import { validateBody, validateQuery } from "../../middleware/validate.js";
import { bindRoute, tagRouter } from "../access/route-access.js";
import type { AuthController } from "./auth.controller.js";

const learn = { kind: "permission", permission: "learn" } as const;
const isPublic = { kind: "public" } as const;

export function createAuthRouter(controller: AuthController, requireAuth: RequestHandler): Router {
  const router = tagRouter(Router(), "/v1/auth");

  bindRoute(router, "post", "/register", isPublic, [
    validateBody(registerBodySchema),
    (req, res, next) => {
      void controller.register(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/login", isPublic, [
    validateBody(loginBodySchema),
    (req, res, next) => {
      void controller.login(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/refresh", isPublic, [
    (req, res, next) => {
      void controller.refresh(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/logout", isPublic, [
    (req, res, next) => {
      void controller.logout(req, res).catch(next);
    },
  ]);

  bindRoute(router, "get", "/verify", isPublic, [
    validateQuery(verifyEmailQuerySchema),
    (req, res, next) => {
      void controller.verifyEmail(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/verify/resend", isPublic, [
    validateBody(resendVerificationBodySchema),
    (req, res, next) => {
      void controller.resendVerification(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/password/forgot", isPublic, [
    validateBody(passwordForgotBodySchema),
    (req, res, next) => {
      void controller.forgotPassword(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/password/reset", isPublic, [
    validateBody(passwordResetBodySchema),
    (req, res, next) => {
      void controller.resetPassword(req, res).catch(next);
    },
  ]);

  bindRoute(router, "get", "/oauth/google", isPublic, [
    (req, res, next) => {
      void controller.oauthGoogleStart(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/oauth/google/callback", isPublic, [
    validateBody(oauthGoogleCallbackBodySchema),
    (req, res, next) => {
      void controller.oauthGoogleCallback(req, res).catch(next);
    },
  ]);

  bindRoute(router, "post", "/oauth/google/link", isPublic, [
    validateBody(oauthGoogleLinkBodySchema),
    (req, res, next) => {
      void controller.oauthGoogleLink(req, res).catch(next);
    },
  ]);

  bindRoute(
    router,
    "delete",
    "/oauth/google",
    learn,
    [
      (req, res, next) => {
        void controller.oauthGoogleUnlink(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "get",
    "/me",
    learn,
    [
      (req, res, next) => {
        void controller.me(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "get",
    "/sessions",
    learn,
    [
      (req, res, next) => {
        void controller.listSessions(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "delete",
    "/sessions/:id",
    learn,
    [
      (req, res, next) => {
        void controller.revokeSession(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  return router;
}

export function createJwksRouter(controller: AuthController): Router {
  const router = tagRouter(Router(), "");

  bindRoute(router, "get", "/.well-known/jwks.json", isPublic, [
    (req, res) => {
      controller.jwks(req, res);
    },
  ]);

  return router;
}
