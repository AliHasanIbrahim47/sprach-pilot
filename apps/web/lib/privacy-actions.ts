"use server";

import {
  ACCESS_TOKEN_COOKIE,
  type PrivacyOverview,
  REFRESH_TOKEN_COOKIE,
  type UpdateConsentBody,
  updateConsentBodySchema,
} from "@sprachpilot/shared";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

import { ApiClientError, apiFetch } from "./api-client";
import { apiErrorTypeToMessageKey } from "./api-error-messages";
import type { SettingsActionResult } from "./settings-result";

async function write<T>(
  path: string,
  method: "PUT" | "POST",
  body?: unknown,
): Promise<SettingsActionResult<T>> {
  try {
    const data = await apiFetch<T>(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    return { ok: true, data };
  } catch (error) {
    return failed(error);
  }
}

function failed<T>(error: unknown): SettingsActionResult<T> {
  if (!(error instanceof ApiClientError)) return { ok: false, errorKey: "Errors.internal" };
  const type = readProblemType(error.body);
  return { ok: false, errorKey: apiErrorTypeToMessageKey(type) };
}

function readProblemType(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    typeof body.type === "string"
  ) {
    return body.type;
  }
  return "internal";
}

export async function requestPrivacyExport(): Promise<SettingsActionResult> {
  return write<undefined>("/v1/privacy/export", "POST");
}

export async function updatePrivacyConsent(
  input: UpdateConsentBody,
): Promise<SettingsActionResult<PrivacyOverview>> {
  const parsed = updateConsentBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write<PrivacyOverview>("/v1/privacy/consents", "PUT", parsed.data);
}

/** Schedules deletion, drops the session cookies, and returns the learner to login. */
export async function requestAccountDeletion(): Promise<SettingsActionResult> {
  const result = await write<undefined>("/v1/privacy/deletion", "POST");
  if (!result.ok) return result;
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  redirect({ href: "/login", locale: await getLocale() });
  return { ok: true };
}
