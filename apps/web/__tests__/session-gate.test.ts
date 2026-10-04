import { describe, expect, it } from "vitest";

import {
  decideSessionGate,
  isProtectedAppPath,
  loginRedirectUrl,
  safeNextPath,
} from "@/lib/session-gate";
import { parseSetCookie } from "@/lib/upstream-cookies";

describe("session gate", () => {
  it("treats locale-prefixed app and dashboard paths as protected", () => {
    expect(isProtectedAppPath("/en/app/decks")).toBe(true);
    expect(isProtectedAppPath("/de/dashboard")).toBe(true);
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

  it("rejects open redirects", () => {
    expect(safeNextPath("/app/decks")).toBe("/app/decks");
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("/%2F%2Fevil.example")).toBeNull();
  });
});

describe("upstream auth cookies", () => {
  it("parses the API set-cookie attributes", () => {
    const parsed = parseSetCookie(
      "sp_access=abc.def.ghi; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
    expect(parsed).toEqual({
      name: "sp_access",
      value: "abc.def.ghi",
      maxAge: 900,
      secure: true,
      path: "/",
    });
  });
});
