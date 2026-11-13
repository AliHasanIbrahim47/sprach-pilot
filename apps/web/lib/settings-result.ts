import type { ApiErrorCode } from "./api-error-messages";

export type SettingsErrorKey = `Errors.${ApiErrorCode}`;

export interface SettingsActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  errorKey?: SettingsErrorKey;
}

export function settingsStatusMessage(
  result: { ok: boolean; errorKey?: SettingsErrorKey },
  success: string,
  tErrors: (key: ApiErrorCode) => string,
): string {
  if (result.ok) return success;
  const key = result.errorKey ?? "Errors.internal";
  return tErrors(key.slice("Errors.".length) as ApiErrorCode);
}
