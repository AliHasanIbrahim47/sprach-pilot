import { ACCESS_TOKEN_COOKIE, parseSessionCookie, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAMES = new Set<string>([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]);

/** Copy API auth cookies onto the Next.js response. Token strings stay httpOnly. */
export async function applyUpstreamAuthCookies(setCookies: readonly string[]): Promise<void> {
  const store = await cookies();
  for (const header of setCookies) {
    const parsed = parseSessionCookie(header);
    if (!parsed || !AUTH_COOKIE_NAMES.has(parsed.name)) continue;
    const scope = {
      path: parsed.path,
      ...(parsed.domain ? { domain: parsed.domain } : {}),
    };
    if (parsed.maxAge === 0 || parsed.value.length === 0) {
      store.delete({ name: parsed.name, ...scope });
      continue;
    }
    store.set(parsed.name, parsed.value, {
      httpOnly: true,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
      maxAge: parsed.maxAge,
      ...scope,
    });
  }
}
