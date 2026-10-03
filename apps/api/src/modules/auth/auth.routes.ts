import { loginBodySchema, registerBodySchema } from "@sprachpilot/shared";
import { Router } from "express";

import { validateBody } from "../../middleware/validate.js";
import type { AuthController } from "./auth.controller.js";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", validateBody(registerBodySchema), (req, res, next) => {
    void controller.register(req, res).catch(next);
  });

  router.post("/login", validateBody(loginBodySchema), (req, res, next) => {
    void controller.login(req, res).catch(next);
  });

  router.post("/logout", (req, res) => {
    controller.logout(req, res);
  });

  return router;
}
