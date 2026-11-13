"use server";

import type {
  EmailChangeBody,
  NotificationPreferences,
  PasswordChangeBody,
  QuietHours,
  SettingsResponse,
  UpdateProfileBody,
} from "@sprachpilot/shared";
import {
  emailChangeBodySchema,
  notificationPreferencesSchema,
  passwordChangeBodySchema,
  quietHoursSchema,
  updateProfileBodySchema,
} from "@sprachpilot/shared";

import { ApiClientError, apiFetch } from "./api-client";
import { apiErrorTypeToMessageKey } from "./api-error-messages";
import type { SettingsActionResult } from "./settings-result";

export type { SettingsActionResult } from "./settings-result";

async function write<T>(
  path: string,
  method: "PATCH" | "PUT" | "POST" | "DELETE",
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

export async function saveProfile(
  input: UpdateProfileBody,
): Promise<SettingsActionResult<SettingsResponse>> {
  const parsed = updateProfileBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write<SettingsResponse>("/v1/settings/profile", "PATCH", parsed.data);
}

export async function saveNotificationPreferences(
  input: NotificationPreferences,
): Promise<SettingsActionResult<SettingsResponse>> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write<SettingsResponse>("/v1/settings/notifications", "PUT", parsed.data);
}

export async function saveQuietHours(
  input: QuietHours,
): Promise<SettingsActionResult<SettingsResponse>> {
  const parsed = quietHoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write<SettingsResponse>("/v1/settings/quiet-hours", "PUT", parsed.data);
}

export async function requestEmailChange(
  input: EmailChangeBody,
): Promise<SettingsActionResult<{ message: string }>> {
  const parsed = emailChangeBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write("/v1/settings/email", "POST", parsed.data);
}

export async function changePassword(
  input: PasswordChangeBody,
): Promise<SettingsActionResult<{ message: string }>> {
  const parsed = passwordChangeBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errorKey: "Errors.validation" };
  return write("/v1/settings/password", "POST", parsed.data);
}

export async function uploadAvatar(file: File): Promise<SettingsActionResult<{ message: string }>> {
  if (!file.type.startsWith("image/") || file.size === 0)
    return { ok: false, errorKey: "Errors.validation" };
  try {
    const data = await apiFetch<{ message: string }>("/v1/settings/avatar", {
      method: "POST",
      headers: { "content-type": file.type },
      body: Buffer.from(await file.arrayBuffer()),
    });
    return { ok: true, data };
  } catch (error) {
    return failed(error);
  }
}

export async function revokeSettingsSession(familyId: string): Promise<SettingsActionResult> {
  if (!familyId) return { ok: false, errorKey: "Errors.validation" };
  return write(`/v1/auth/sessions/${encodeURIComponent(familyId)}`, "DELETE");
}
