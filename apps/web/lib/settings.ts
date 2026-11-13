import "server-only";

import type { SessionListResponse, SettingsResponse } from "@sprachpilot/shared";

import { apiFetch } from "./api-client";

export async function getSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/v1/settings");
}

export async function getSettingsSessions(): Promise<SessionListResponse> {
  return apiFetch<SessionListResponse>("/v1/auth/sessions");
}
