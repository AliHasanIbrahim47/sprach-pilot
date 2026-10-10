"use server";

import type {
  LoginBody,
  PasswordForgotBody,
  PasswordResetBody,
  RegisterBody,
} from "@sprachpilot/shared";
import {
  ACCESS_TOKEN_COOKIE,
  loginBodySchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  REFRESH_TOKEN_COOKIE,
  registerBodySchema,
  resendVerificationBodySchema,
} from "@sprachpilot/shared";
import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

import { ApiClientError, apiFetch } from "./api-client";
import type { AuthActionResult } from "./auth-action-result";
import {
  type AuthFieldErrors,
  isAuthField,
  normalizeFieldCode,
  zodIssuesToFieldErrors,
} from "./auth-field-errors";
import { emailLinkStatusFromBody } from "./email-link-status";
import { serverConfig } from "./server-config";

export async function registerAccount(input: RegisterBody): Promise<AuthActionResult> {
  const parsed = registerBodySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult(zodIssuesToFieldErrors(parsed.error.issues));
  }

  try {
    await apiFetch("/v1/auth/register", {
      method: "POST",
      headers: await requestHeaders(),
      body: JSON.stringify(parsed.data),
      forwardCookies: false,
    });
    return { ok: true, intent: "register" };
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function loginAccount(input: LoginBody): Promise<AuthActionResult> {
  const parsed = loginBodySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult(zodIssuesToFieldErrors(parsed.error.issues));
  }

  try {
    await apiFetch("/v1/auth/login", {
      method: "POST",
      headers: await requestHeaders(),
      body: JSON.stringify(parsed.data),
      forwardCookies: false,
      applyAuthCookies: true,
    });
    return { ok: true, intent: "login" };
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function requestPasswordReset(input: PasswordForgotBody): Promise<AuthActionResult> {
  const parsed = passwordForgotBodySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult(zodIssuesToFieldErrors(parsed.error.issues));
  }

  try {
    await apiFetch("/v1/auth/password/forgot", {
      method: "POST",
      headers: await requestHeaders(),
      body: JSON.stringify(parsed.data),
      forwardCookies: false,
    });
    return { ok: true, intent: "forgot" };
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function resetPassword(input: PasswordResetBody): Promise<AuthActionResult> {
  const parsed = passwordResetBodySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult(zodIssuesToFieldErrors(parsed.error.issues));
  }

  try {
    await apiFetch("/v1/auth/password/reset", {
      method: "POST",
      headers: await requestHeaders(),
      body: JSON.stringify(parsed.data),
      forwardCookies: false,
    });
    return { ok: true, intent: "reset" };
  } catch (error) {
    return mapLinkError(error);
  }
}

export async function resendVerification(input: { email?: string }): Promise<AuthActionResult> {
  const parsed = resendVerificationBodySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult(zodIssuesToFieldErrors(parsed.error.issues));
  }

  try {
    await apiFetch("/v1/auth/verify/resend", {
      method: "POST",
      headers: await requestHeaders(),
      body: JSON.stringify(parsed.data),
      forwardCookies: parsed.data.email === undefined,
    });
    return { ok: true, intent: "resend" };
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    await apiFetch("/v1/auth/logout", {
      method: "POST",
      applyAuthCookies: true,
    });
  } catch {
    // Still drop local cookies when the API is unreachable.
  }

  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  redirect({ href: "/login", locale: await getLocale() });
}

function validationResult(fieldErrors: AuthFieldErrors): AuthActionResult {
  if (Object.keys(fieldErrors).length === 0) return { ok: false, code: "validation" };
  return { ok: false, code: "validation", fieldErrors };
}

async function requestHeaders(): Promise<Headers> {
  const requestHeaders = new Headers({
    "content-type": "application/json",
    "x-ui-locale": await getLocale(),
  });
  const secret = serverConfig.internalApiSecret;
  if (!secret) return requestHeaders;

  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwarded || incoming.get("x-real-ip")?.trim();
  if (!clientIp) return requestHeaders;

  requestHeaders.set("x-sprachpilot-internal", secret);
  requestHeaders.set("x-sprachpilot-client-ip", clientIp);
  return requestHeaders;
}

function mapLinkError(error: unknown): AuthActionResult {
  const mapped = mapAuthError(error);
  if (mapped.ok || !(error instanceof ApiClientError)) return mapped;
  const linkStatus = emailLinkStatusFromBody(error.body);
  if (!linkStatus) return mapped;
  return { ...mapped, code: "validation", linkStatus };
}

function mapAuthError(error: unknown): AuthActionResult {
  if (!(error instanceof ApiClientError)) return { ok: false, code: "internal" };

  const fieldErrors = readFieldErrors(error.body);
  if (error.status === 400) {
    return fieldErrors
      ? { ok: false, code: "validation", fieldErrors }
      : { ok: false, code: "validation" };
  }
  if (error.status === 401) return { ok: false, code: "unauthorized" };
  if (error.status === 403) return { ok: false, code: "forbidden" };
  if (error.status === 429) {
    return error.retryAfterSeconds === undefined
      ? { ok: false, code: "rate-limited" }
      : { ok: false, code: "rate-limited", retryAfterSeconds: error.retryAfterSeconds };
  }
  return { ok: false, code: "internal" };
}

function readFieldErrors(body: unknown): AuthFieldErrors | undefined {
  if (typeof body !== "object" || body === null || !("errors" in body)) return undefined;
  const errors = body.errors;
  if (!Array.isArray(errors)) return undefined;

  const fieldErrors: AuthFieldErrors = {};
  for (const error of errors) {
    if (typeof error !== "object" || error === null) continue;
    if (!("field" in error) || !("code" in error)) continue;
    const { field, code } = error;
    if (typeof field !== "string" || typeof code !== "string" || !isAuthField(field)) continue;
    fieldErrors[field] = normalizeFieldCode(field, code);
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}
