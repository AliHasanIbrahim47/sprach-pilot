import { assignRoleBodySchema } from "@sprachpilot/shared";
import type { RequestHandler, Router } from "express";
import { Router as createRouter } from "express";

import { validateBody } from "../../middleware/validate.js";
import type { RoleController } from "./role.controller.js";
import { bindRoute, tagRouter } from "./route-access.js";

export function createAdminRouter(controller: RoleController, requireAuth: RequestHandler): Router {
  const router = tagRouter(createRouter(), "/v1");

  bindRoute(
    router,
    "patch",
    "/admin/users/:userId",
    { kind: "permission", permission: "roles.assign" },
    [
      validateBody(assignRoleBodySchema),
      (req, res, next) => {
        void controller.assignRole(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  return router;
}
