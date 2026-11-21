import { parseSessionCookie } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import {
  applySetCookies,
  decideSessionGate,
  isProtectedAppPath,
  loginRedirectUrl,
} from "@/lib/session-gate";

describe("session gate", () => {
  it("treats locale-prefixed app and dashboard paths as protected", () => {
    expect(isProtectedAppPath("/en/app/decks")).toBe(true);
    expect(isProtectedAppPath("/de/dashboard")).toBe(true);
    expect(isProtectedAppPath("/en/onboarding")).toBe(true);
    expect(isProtectedAppPath("/en/settings")).toBe(true);
    expect(isProtectedAppPath("/de/settings/privacy")).toBe(true);
    expect(isProtectedAppPath("/en/confirm-email")).toBe(false);
    expect(isProtectedAppPath("/en/login")).toBe(false);
    expect(isProtectedAppPath("/en")).toBe(false);
  });

  it("sends an anonymous visitor to login and keeps the app path", () => {
    expect(
      decideSessionGate({
        pathname: "/en/app/decks",
        accessValid: false,
        hasRefreshCookie: false,
      }),
    ).toBe("login");

    const target = loginRedirectUrl(new URL("http://localhost:3000/en/app/decks"));
    expect(target.pathname).toBe("/en/login");
    expect(target.searchParams.get("next")).toBe("/app/decks");
  });

  it("refreshes when the access token is missing and a refresh cookie is present", () => {
    expect(
      decideSessionGate({
        pathname: "/en/dashboard",
        accessValid: false,
        hasRefreshCookie: true,
      }),
    ).toBe("refresh");
    expect(
      decideSessionGate({
        pathname: "/en/dashboard",
        accessValid: true,
        hasRefreshCookie: true,
      }),
    ).toBe("continue");
  });

  it("replaces rotated auth cookies for the rest of the same request", () => {
    expect(
      applySetCookies("sp_access=old; theme=dark; sp_refresh=keep", [
        "sp_access=new.token; Max-Age=900; Path=/; HttpOnly",
        "sp_refresh=rotated; Max-Age=1209600; Path=/; HttpOnly",
      ]),
    ).toBe("sp_access=new.token; theme=dark; sp_refresh=rotated");
  });
});

describe("upstream auth cookies", () => {
  it("parses the API set-cookie attributes", () => {
    expect(
      parseSessionCookie(
        "sp_access=abc.def.ghi; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=sprachpilot.test",
      ),
    ).toEqual({
      name: "sp_access",
      value: "abc.def.ghi",
      maxAge: 900,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: "sprachpilot.test",
    });
  });

  it("reads an omitted SameSite as lax and an omitted Domain as absent", () => {
    const parsed = parseSessionCookie("sp_access=abc; Max-Age=900; Path=/; HttpOnly");
    expect(parsed?.sameSite).toBe("lax");
    expect(parsed?.domain).toBeUndefined();
  });

  it("keeps Domain and Path on a cleared cookie", () => {
    expect(
      parseSessionCookie("sp_refresh=; Max-Age=0; Path=/; HttpOnly; Domain=sprachpilot.test"),
    ).toMatchObject({
      name: "sp_refresh",
      value: "",
      maxAge: 0,
      path: "/",
      domain: "sprachpilot.test",
    });
  });
});
