import type {
  LoginBody,
  OAuthGoogleCallbackBody,
  OAuthGoogleLinkBody,
  PasswordForgotBody,
  PasswordResetBody,
  RegisterBody,
  ResendVerificationBody,
  VerifyEmailQuery,
} from "@sprachpilot/shared";
import {
  ACCESS_TOKEN_COOKIE,
  NotFoundError,
  REFRESH_TOKEN_COOKIE,
  UnauthorizedError,
  ValidationError,
} from "@sprachpilot/shared";
import type { Request, Response } from "express";

import type { AuthService } from "./auth.service.js";
import {
  type AuthCookieOptions,
  clearSessionCookies,
  readRequestCookie,
  setSessionCookies,
} from "./auth-cookies.js";
import type { OAuthService } from "./oauth.service.js";
import { getRequestAuth } from "./require-auth.js";

export interface AuthController {
  register(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  refresh(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  listSessions(req: Request, res: Response): Promise<void>;
  revokeSession(req: Request, res: Response): Promise<void>;
  verifyEmail(req: Request, res: Response): Promise<void>;
  resendVerification(req: Request, res: Response): Promise<void>;
  forgotPassword(req: Request, res: Response): Promise<void>;
  resetPassword(req: Request, res: Response): Promise<void>;
  me(req: Request, res: Response): Promise<void>;
  oauthGoogleStart(req: Request, res: Response): Promise<void>;
  oauthGoogleCallback(req: Request, res: Response): Promise<void>;
  oauthGoogleLink(req: Request, res: Response): Promise<void>;
  oauthGoogleUnlink(req: Request, res: Response): Promise<void>;
  jwks(req: Request, res: Response): void;
}

export function createAuthController(
  service: AuthService,
  oauth: OAuthService,
  resolveIp: (req: Request) => string,
  cookieOptions: AuthCookieOptions,
  jwksDocument: () => unknown,
  readOptionalUserId: (req: Request) => Promise<string | undefined>,
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

    async verifyEmail(req, res) {
      const query = req.query as VerifyEmailQuery;
      const result = await service.verifyEmail(query.token);
      noStore(res);
      res.status(200).json(result);
    },

    async resendVerification(req, res) {
      const body = req.body as ResendVerificationBody;
      const userId = await readOptionalUserId(req);
      if (!userId && !body.email) {
        throw new ValidationError({
          errors: [
            {
              field: "email",
              code: "email_invalid",
              message: "Enter a valid email address.",
            },
          ],
        });
      }
      const result = await service.resendVerification(
        {
          ...(userId !== undefined ? { userId } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
        },
        requestContext(req, resolveIp),
      );
      noStore(res);
      res.status(202).json(result);
    },

    async forgotPassword(req, res) {
      const body = req.body as PasswordForgotBody;
      const result = await service.forgotPassword(body, requestContext(req, resolveIp));
      noStore(res);
      res.status(202).json(result);
    },

    async resetPassword(req, res) {
      const body = req.body as PasswordResetBody;
      const result = await service.resetPassword(body);
      noStore(res);
      res.status(200).json(result);
    },

    async me(req, res) {
      const auth = getRequestAuth(req);
      const result = await service.getAccount(auth.sub);
      noStore(res);
      res.status(200).json(result);
    },

    async oauthGoogleStart(req, res) {
      const returnTo = readOptionalString(req.query["returnTo"]);
      const locale = readOptionalString(req.query["locale"]) ?? req.get("x-ui-locale")?.trim();
      const result = await oauth.start({
        ...(returnTo !== undefined ? { returnTo } : {}),
        ...(locale !== undefined ? { locale } : {}),
      });
      noStore(res);
      res.redirect(302, result.authorizationUrl);
    },

    async oauthGoogleCallback(req, res) {
      const body = req.body as OAuthGoogleCallbackBody;
      const result = await oauth.callback(body, requestContext(req, resolveIp));
      noStore(res);
      if (result.status === "link_required") {
        res.status(200).json({
          status: result.status,
          linkToken: result.linkToken,
          email: result.email,
          locale: result.locale,
        });
        return;
      }
      setSessionCookies(res, result.credentials, cookieOptions);
      res.status(200).json({
        status: result.status,
        needsOnboarding: result.needsOnboarding,
        locale: result.locale,
        user: result.user,
      });
    },

    async oauthGoogleLink(req, res) {
      const body = req.body as OAuthGoogleLinkBody;
      const result = await oauth.confirmLink(body, requestContext(req, resolveIp));
      setSessionCookies(res, result.credentials, cookieOptions);
      noStore(res);
      res.status(200).json({
        status: result.status,
        needsOnboarding: result.needsOnboarding,
        locale: result.locale,
        user: result.user,
      });
    },

    async oauthGoogleUnlink(req, res) {
      const auth = getRequestAuth(req);
      await oauth.unlink(auth.sub);
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
): { ip: string; userAgent?: string; locale?: string } {
  const userAgent = req.get("user-agent");
  const locale = req.get("x-ui-locale")?.trim();
  return {
    ip: resolveIp(req),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(locale !== undefined && locale.length > 0 ? { locale } : {}),
  };
}

function readSessionId(req: Request): string {
  const raw = req.params["id"];
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  if (!sessionId) throw new NotFoundError("Session not found");
  return sessionId;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim().length > 0) {
    return value[0].trim();
  }
  return undefined;
}

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}
