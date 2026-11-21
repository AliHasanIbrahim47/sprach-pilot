import { safeReturnPath } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { postSignInPath } from "@/lib/return-path";

describe("safe return path", () => {
  it("keeps an in-app path and rejects an open redirect", () => {
    expect(safeReturnPath("/app/decks")).toBe("/app/decks");
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
    expect(safeReturnPath("/%2F%2Fevil.example")).toBeNull();
  });

  it("strips a leading locale", () => {
    expect(safeReturnPath("/en/app/decks")).toBe("/app/decks");
    expect(safeReturnPath("/de")).toBe("/");
  });
});

describe("post sign-in path", () => {
  it("opens onboarding ahead of a saved path", () => {
    expect(postSignInPath({ needsOnboarding: true, returnTo: "/app/decks" })).toBe("/onboarding");
  });

  it("opens the saved path once onboarding is done", () => {
    expect(postSignInPath({ needsOnboarding: false, returnTo: "/en/settings" })).toBe("/settings");
  });

  it("opens the dashboard when the saved path is missing", () => {
    expect(postSignInPath({ needsOnboarding: false, returnTo: null })).toBe("/dashboard");
    expect(postSignInPath({ needsOnboarding: false, returnTo: "//evil.example" })).toBe(
      "/dashboard",
    );
  });
});
