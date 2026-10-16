import type { AssignRoleBody } from "@sprachpilot/shared";
import { NotFoundError } from "@sprachpilot/shared";
import type { Request, Response } from "express";

import { getRequestAuth } from "../auth/require-auth.js";
import type { RoleService } from "./role.service.js";

export interface RoleController {
  assignRole(req: Request, res: Response): Promise<void>;
}

export function createRoleController(roles: RoleService): RoleController {
  return {
    async assignRole(req, res) {
      const auth = getRequestAuth(req);
      const userId = readUserId(req);
      const body = req.body as AssignRoleBody;
      const result = await roles.assignRole({
        actorId: auth.sub,
        targetUserId: userId,
        role: body.role,
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    },
  };
}

function readUserId(req: Request): string {
  const raw = req.params["userId"];
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId) throw new NotFoundError("User not found");
  return userId;
}
