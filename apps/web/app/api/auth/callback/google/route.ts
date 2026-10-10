import type { OAuthCallbackResponse } from "@sprachpilot/shared";
import { NextResponse } from "next/server";

import { ApiClientError, apiFetch } from "@/lib/api-client";
import { serverConfig } from "@/lib/server-config";
import { safeNextPath } from "@/lib/session-gate";

export async function GET(request: Request): Promise<NextResponse> {
  const incoming = new URL(request.url);

  if (!serverConfig.features.googleOAuthEnabled) {
    return NextResponse.redirect(new URL("/en/login?oauth=disabled", request.url));
  }

  const providerError = incoming.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL("/en/login?oauth=unavailable", request.url));
  }

  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/en/login?oauth=failed", request.url));
  }

  try {
    const result = await apiFetch<OAuthCallbackResponse>("/v1/auth/oauth/google/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, state }),
      forwardCookies: false,
      applyAuthCookies: true,
    });

    const locale = sanitizeLocale(result.locale);

    if (result.status === "link_required") {
      const target = new URL(`/${locale}/link-google`, request.url);
      target.searchParams.set("token", result.linkToken);
      target.searchParams.set("email", result.email);
      return NextResponse.redirect(target);
    }

    const next = result.needsOnboarding ? "/onboarding" : (safeNextPath(null) ?? "/dashboard");
    return NextResponse.redirect(new URL(`/${locale}${next}`, request.url));
  } catch (error) {
    const reason = oauthErrorReason(error);
    return NextResponse.redirect(new URL(`/en/login?oauth=${reason}`, request.url));
  }
}

function sanitizeLocale(value: string): string {
  if (/^[a-z]{2}$/.test(value)) return value;
  return "en";
}

function oauthErrorReason(error: unknown): string {
  if (!(error instanceof ApiClientError)) return "failed";
  if (error.status === 502) return "unavailable";
  if (error.status === 401) return "failed";
  if (error.status === 403) return "disabled";
  return "failed";
}
