import type { LoginBody, RegisterBody } from "@sprachpilot/shared";
import {
  ACCESS_TOKEN_COOKIE,
  NotFoundError,
  REFRESH_TOKEN_COOKIE,
  UnauthorizedError,
} from "@sprachpilot/shared";
import type { Request, Response } from "express";

import type { AuthService } from "./auth.service.js";
import {
  type AuthCookieOptions,
  clearSessionCookies,
  readRequestCookie,
  setSessionCookies,
} from "./auth-cookies.js";
import { getRequestAuth } from "./require-auth.js";

export interface AuthController {
  register(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  refresh(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  listSessions(req: Request, res: Response): Promise<void>;
  revokeSession(req: Request, res: Response): Promise<void>;
  jwks(req: Request, res: Response): void;
}

export function createAuthController(
  service: AuthService,
  resolveIp: (req: Request) => string,
  cookieOptions: AuthCookieOptions,
  jwksDocument: () => unknown,
): AuthController {
  return {
    async register(req, res) {
      const body = req.body as RegisterBody;
      const result = await service.register(body, requestContext(req, resolveIp));
      noStore(res);
      res.status(202).json(result);
    },

    async login(req, res) {
      const body = req.body as LoginBody;
      const result = await service.login(body, requestContext(req, resolveIp));
      const { credentials, ...bodyResult } = result;
      setSessionCookies(res, credentials, cookieOptions);
      noStore(res);
      res.status(200).json(bodyResult);
    },

    async refresh(req, res) {
      const refreshToken = readRequestCookie(req, REFRESH_TOKEN_COOKIE);
      if (!refreshToken) {
        clearSessionCookies(res, cookieOptions);
        noStore(res);
        throw new UnauthorizedError();
      }

      try {
        const credentials = await service.refresh(refreshToken);
        setSessionCookies(res, credentials, cookieOptions);
        noStore(res);
        res.status(200).json({ status: "refreshed" });
      } catch (error) {
        if (error instanceof UnauthorizedError) clearSessionCookies(res, cookieOptions);
        throw error;
      }
    },

    async logout(req, res) {
      const refreshToken = readRequestCookie(req, REFRESH_TOKEN_COOKIE);
      const accessToken = readRequestCookie(req, ACCESS_TOKEN_COOKIE);
      await service.logout({
        ...(refreshToken !== undefined ? { refreshToken } : {}),
        ...(accessToken !== undefined ? { accessToken } : {}),
      });
      clearSessionCookies(res, cookieOptions);
      noStore(res);
      res.status(204).end();
    },

    async listSessions(req, res) {
      const auth = getRequestAuth(req);
      const result = await service.listSessions(auth.sub, auth.sid);
      noStore(res);
      res.status(200).json(result);
    },

    async revokeSession(req, res) {
      const auth = getRequestAuth(req);
      const sessionId = readSessionId(req);
      await service.revokeSession(auth.sub, sessionId);
      if (sessionId === auth.sid) clearSessionCookies(res, cookieOptions);
      noStore(res);
      res.status(204).end();
    },

    jwks(_req, res) {
      res.status(200).json(jwksDocument());
    },
  };
}

function requestContext(
  req: Request,
  resolveIp: (req: Request) => string,
): { ip: string; userAgent?: string } {
  const userAgent = req.get("user-agent");
  return {
    ip: resolveIp(req),
    ...(userAgent !== undefined ? { userAgent } : {}),
  };
}

function readSessionId(req: Request): string {
  const raw = req.params["id"];
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  if (!sessionId) throw new NotFoundError("Session not found");
  return sessionId;
}

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}
