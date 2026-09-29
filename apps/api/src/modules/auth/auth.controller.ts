import type { Request, Response } from "express";

export interface AuthController {
  register(req: Request, res: Response): void;
}

/**
 * Registration stub until SP-012. Validation is real; persistence is not.
 */
export function createAuthController(): AuthController {
  return {
    register(_req, res) {
      res.status(501).json({
        status: "accepted",
        message: "Registration is validated but not implemented yet (SP-012).",
      });
    },
  };
}
