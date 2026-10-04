import { ACCESS_TOKEN_COOKIE, UnauthorizedError } from "@sprachpilot/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { readRequestCookie } from "./auth-cookies.js";
import type { AccessTokenClaims, TokenService } from "./token.service.js";

const claimsByRequest = new WeakMap<Request, AccessTokenClaims>();

export function getRequestAuth(req: Request): AccessTokenClaims {
  const claims = claimsByRequest.get(req);
  if (!claims) throw new UnauthorizedError();
  return claims;
}

/**
 * Verifies the access-token cookie and attaches its claims.
 * No database lookup: revocation is enforced when the refresh token is next used.
 */
export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = readRequestCookie(req, ACCESS_TOKEN_COOKIE);
    if (!token) {
      next(new UnauthorizedError());
      return;
    }

    void tokens.verifyAccessToken(token).then(
      (claims) => {
        claimsByRequest.set(req, claims);
        next();
      },
      () => {
        next(new UnauthorizedError());
      },
    );
  };
}
