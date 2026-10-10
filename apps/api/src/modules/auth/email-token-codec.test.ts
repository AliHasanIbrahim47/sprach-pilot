import { describe, expect, it } from "vitest";

import { createEmailTokenCodec } from "./email-token-codec.js";

describe("email token codec", () => {
  it("creates 256-bit tokens and stores a stable hash", () => {
    const codec = createEmailTokenCodec("test-pepper-value");
    const token = codec.create();
    const hash = codec.hash(token);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(codec.hash(token)).toBe(hash);
    expect(codec.hash("other-token-value")).not.toBe(hash);
  });
});
