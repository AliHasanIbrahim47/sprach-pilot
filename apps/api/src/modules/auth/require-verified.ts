import { AUTH_COPY, ForbiddenError, UnauthorizedError } from "@sprachpilot/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { UserRepository } from "./auth.repository.js";
import { getRequestAuth } from "./require-auth.js";

/**
 * Blocks document upload, tandem, and café routes until the email is verified.
 * Mount it after `requireAuth`. Sign-in itself stays allowed (FR-1).
 */
export function createRequireVerifiedEmail(users: UserRepository): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    let userId: string;
    try {
      userId = getRequestAuth(req).sub;
    } catch (error) {
      next(error);
      return;
    }

    void users.findById(userId).then(
      (user) => {
        if (!user || user.deletedAt) {
          next(new UnauthorizedError());
          return;
        }
        if (!user.emailVerifiedAt) {
          next(new ForbiddenError(AUTH_COPY.emailVerificationRequired));
          return;
        }
        next();
      },
      (error: unknown) => {
        next(error);
      },
    );
  };
}
