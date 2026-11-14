import "server-only";

import type { PrivacyOverview } from "@sprachpilot/shared";

import { apiFetch } from "./api-client";

export async function getPrivacy(): Promise<PrivacyOverview> {
  return apiFetch<PrivacyOverview>("/v1/privacy");
}
