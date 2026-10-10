import "server-only";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import { cookies } from "next/headers";

/** True when this browser still holds an access or refresh cookie. */
export async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return store.has(ACCESS_TOKEN_COOKIE) || store.has(REFRESH_TOKEN_COOKIE);
}
