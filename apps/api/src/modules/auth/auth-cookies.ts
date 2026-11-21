import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  serializeSessionCookie,
} from "@sprachpilot/shared";
import type { Request, Response } from "express";

export interface AuthCookieOptions {
  secure: boolean;
  domain: string | undefined;
}

export interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
}

export function readRequestCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    if (trimmed.slice(0, separator) !== name) continue;
    return decodeCookieValue(trimmed.slice(separator + 1));
  }

  return undefined;
}

export function setSessionCookies(
  res: Response,
  cookies: SessionCookies,
  options: AuthCookieOptions,
): void {
  res.append(
    "Set-Cookie",
    serializeSessionCookie(
      ACCESS_TOKEN_COOKIE,
      cookies.accessToken,
      cookies.accessMaxAgeSeconds,
      options,
    ),
  );
  res.append(
    "Set-Cookie",
    serializeSessionCookie(
      REFRESH_TOKEN_COOKIE,
      cookies.refreshToken,
      cookies.refreshMaxAgeSeconds,
      options,
    ),
  );
}

export function clearSessionCookies(res: Response, options: AuthCookieOptions): void {
  res.append("Set-Cookie", serializeSessionCookie(ACCESS_TOKEN_COOKIE, "", 0, options));
  res.append("Set-Cookie", serializeSessionCookie(REFRESH_TOKEN_COOKIE, "", 0, options));
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
