import { NextResponse } from "next/server";

import { serverConfig } from "@/lib/server-config";
import { safeNextPath } from "@/lib/session-gate";

export function GET(request: Request): NextResponse {
  if (!serverConfig.features.googleOAuthEnabled) {
    return NextResponse.redirect(new URL("/en/login?oauth=disabled", request.url));
  }

  const incoming = new URL(request.url);
  const locale = incoming.searchParams.get("locale")?.trim() || "en";
  const returnTo = safeNextPath(incoming.searchParams.get("returnTo"));

  const target = new URL("/v1/auth/oauth/google", serverConfig.apiBaseUrl);
  target.searchParams.set("locale", locale);
  if (returnTo) target.searchParams.set("returnTo", returnTo);

  return NextResponse.redirect(target);
}
