import "server-only";

import type { AccountResponse } from "@sprachpilot/shared";

import { apiFetch } from "./api-client";

export async function getAccount(): Promise<AccountResponse | null> {
  try {
    return await apiFetch<AccountResponse>("/v1/auth/me");
  } catch {
    return null;
  }
}
