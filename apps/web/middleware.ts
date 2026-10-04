import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { decideSessionGate, isProtectedAppPath, loginRedirectUrl } from "./lib/session-gate";

const handleI18n = createMiddleware(routing);

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksBaseUrl: string | undefined;

function remoteJwks(apiBaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks || jwksBaseUrl !== apiBaseUrl) {
    jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", apiBaseUrl), {
      cacheMaxAge: 60_000,
    });
    jwksBaseUrl = apiBaseUrl;
  }
  return jwks;
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const i18nResponse = handleI18n(request);
  if (i18nResponse.headers.has("location")) return i18nResponse;
  if (!isProtectedAppPath(request.nextUrl.pathname)) return i18nResponse;

  // Edge middleware cannot import the server-only config module.
  // eslint-disable-next-line no-restricted-properties -- API_BASE_URL is server-only and read here directly
  const apiBaseUrl = process.env["API_BASE_URL"] ?? "http://localhost:3001";
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const accessValid =
    accessToken !== undefined && (await accessTokenIsCurrent(accessToken, apiBaseUrl));
  const gate = decideSessionGate({
    pathname: request.nextUrl.pathname,
    accessValid,
    hasRefreshCookie: refreshToken !== undefined,
  });
  if (gate === "continue") return i18nResponse;

  if (gate === "refresh" && refreshToken) {
    const rotated = await refreshSession(refreshToken, apiBaseUrl);
    if (rotated) {
      for (const cookie of rotated) i18nResponse.headers.append("set-cookie", cookie);
      return i18nResponse;
    }
  }

  const redirectResponse = NextResponse.redirect(loginRedirectUrl(request.nextUrl));
  redirectResponse.cookies.delete(ACCESS_TOKEN_COOKIE);
  redirectResponse.cookies.delete(REFRESH_TOKEN_COOKIE);
  return redirectResponse;
}

async function accessTokenIsCurrent(token: string, apiBaseUrl: string): Promise<boolean> {
  try {
    await jwtVerify(token, remoteJwks(apiBaseUrl), { algorithms: ["EdDSA"], clockTolerance: 0 });
    return true;
  } catch {
    return false;
  }
}

async function refreshSession(refreshToken: string, apiBaseUrl: string): Promise<string[] | null> {
  try {
    const response = await fetch(new URL("/v1/auth/refresh", apiBaseUrl), {
      method: "POST",
      headers: {
        accept: "application/json",
        cookie: `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refreshToken)}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const cookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    const authCookies = cookies.filter(
      (cookie) =>
        cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`) ||
        cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`),
    );
    return authCookies.length > 0 ? authCookies : null;
  } catch {
    return null;
  }
}

export const config = {
  // Skip API, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
