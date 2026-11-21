import { safeReturnPath } from "@sprachpilot/shared";

/** Path to open after a sign-in. No locale prefix. */
export function postSignInPath(input: {
  needsOnboarding: boolean;
  returnTo?: string | null;
}): string {
  if (input.needsOnboarding) return "/onboarding";
  return safeReturnPath(input.returnTo) ?? "/dashboard";
}
