import { describe, expect, it } from "vitest";

import { isCommonPassword, loadCommonPasswords } from "./password-policy.js";

describe("common password list", () => {
  it("includes password123 and matches case-insensitively", () => {
    const passwords = loadCommonPasswords();
    expect(passwords.size).toBeGreaterThan(1000);
    expect(passwords.has("password123")).toBe(true);
    expect(passwords.has("Password123")).toBe(false);
    expect(isCommonPassword("Password123", passwords)).toBe(true);
  });

  it("accepts a long uncommon passphrase", () => {
    expect(isCommonPassword("correct-horse-battery-staple-9")).toBe(false);
  });
});
