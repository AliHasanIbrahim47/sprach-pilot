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
import type { AuthController } from "./auth.controller.js";

export function createAuthRouter(controller: AuthController, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post("/register", validateBody(registerBodySchema), (req, res, next) => {
    void controller.register(req, res).catch(next);
  });

  router.post("/login", validateBody(loginBodySchema), (req, res, next) => {
    void controller.login(req, res).catch(next);
  });

  router.post("/refresh", (req, res, next) => {
    void controller.refresh(req, res).catch(next);
  });

  router.post("/logout", (req, res, next) => {
    void controller.logout(req, res).catch(next);
  });

  router.get("/verify", validateQuery(verifyEmailQuerySchema), (req, res, next) => {
    void controller.verifyEmail(req, res).catch(next);
  });

  router.post("/verify/resend", validateBody(resendVerificationBodySchema), (req, res, next) => {
    void controller.resendVerification(req, res).catch(next);
  });

  router.post("/password/forgot", validateBody(passwordForgotBodySchema), (req, res, next) => {
    void controller.forgotPassword(req, res).catch(next);
  });

  router.post("/password/reset", validateBody(passwordResetBodySchema), (req, res, next) => {
    void controller.resetPassword(req, res).catch(next);
  });

  router.get("/oauth/google", (req, res, next) => {
    void controller.oauthGoogleStart(req, res).catch(next);
  });

  router.post(
    "/oauth/google/callback",
    validateBody(oauthGoogleCallbackBodySchema),
    (req, res, next) => {
      void controller.oauthGoogleCallback(req, res).catch(next);
    },
  );

  router.post("/oauth/google/link", validateBody(oauthGoogleLinkBodySchema), (req, res, next) => {
    void controller.oauthGoogleLink(req, res).catch(next);
  });

  router.delete("/oauth/google", requireAuth, (req, res, next) => {
    void controller.oauthGoogleUnlink(req, res).catch(next);
  });

  router.get("/me", requireAuth, (req, res, next) => {
    void controller.me(req, res).catch(next);
  });

  router.get("/sessions", requireAuth, (req, res, next) => {
    void controller.listSessions(req, res).catch(next);
  });

  router.delete("/sessions/:id", requireAuth, (req, res, next) => {
    void controller.revokeSession(req, res).catch(next);
  });

  return router;
}

export function createJwksRouter(controller: AuthController): Router {
  const router = Router();
  router.get("/.well-known/jwks.json", (req, res) => {
    controller.jwks(req, res);
  });
  return router;
}
