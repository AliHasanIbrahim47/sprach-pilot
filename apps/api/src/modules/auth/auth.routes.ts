import { registerBodySchema } from "@sprachpilot/shared";
import { Router } from "express";

import { validateBody } from "../../middleware/validate.js";
import type { AuthController } from "./auth.controller.js";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", validateBody(registerBodySchema), (req, res) => {
    controller.register(req, res);
  });

  return router;
}
