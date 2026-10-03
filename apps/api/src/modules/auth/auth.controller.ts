import type { LoginBody, RegisterBody } from "@sprachpilot/shared";
import type { Request, Response } from "express";

import type { AuthService } from "./auth.service.js";

export interface AuthController {
  register(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): void;
}

export function createAuthController(
  service: AuthService,
  resolveIp: (req: Request) => string,
): AuthController {
  return {
    async register(req, res) {
      const body = req.body as RegisterBody;
      const result = await service.register(body, { ip: resolveIp(req) });
      res.status(202).json(result);
    },

    async login(req, res) {
      const body = req.body as LoginBody;
      const result = await service.login(body, { ip: resolveIp(req) });
      res.status(200).json(result);
    },

    /**
     * Token revocation is SP-013. Until then logout acknowledges the request
     * without a session cookie to clear.
     */
    logout(_req, res) {
      res.status(204).end();
    },
  };
}
