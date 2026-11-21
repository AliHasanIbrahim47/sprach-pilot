import { safeReturnPath } from "@sprachpilot/shared";
import { NextResponse } from "next/server";

import { serverConfig } from "@/lib/server-config";

export function GET(request: Request): NextResponse {
  if (!serverConfig.features.googleOAuthEnabled) {
    return NextResponse.redirect(new URL("/en/login?oauth=disabled", request.url));
  }

  const incoming = new URL(request.url);
  const locale = incoming.searchParams.get("locale")?.trim() || "en";
  const returnTo = safeReturnPath(incoming.searchParams.get("returnTo"));

  const target = new URL("/v1/auth/oauth/google", serverConfig.apiBaseUrl);
  target.searchParams.set("locale", locale);
  if (returnTo) target.searchParams.set("returnTo", returnTo);

  return NextResponse.redirect(target);
}
