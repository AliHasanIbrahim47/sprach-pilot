import { ARGON2ID_OPTIONS, hashPassword, verifyPassword } from "@sprachpilot/db";
import { describe, expect, it } from "vitest";

describe("argon2id password hashing", () => {
  it("uses at least 19 MiB and verifies only the original password", async () => {
    expect(ARGON2ID_OPTIONS.memoryCost).toBeGreaterThanOrEqual(19_456);
    expect(ARGON2ID_OPTIONS.timeCost).toBe(2);
    expect(ARGON2ID_OPTIONS.parallelism).toBe(1);

    const encoded = await hashPassword("correct-horse-battery");
    expect(encoded.startsWith("$argon2id$")).toBe(true);
    expect(encoded).toContain("m=19456");
    expect(await verifyPassword(encoded, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(encoded, "correct-horse-battery-nope")).toBe(false);
  });
});
