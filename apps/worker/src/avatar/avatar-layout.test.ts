import {
  avatarKeyFromUrl,
  avatarPrefixes,
  avatarPublishedKey,
  avatarSourceKey,
  publicObjectUrl,
} from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

const storage = { endpoint: "http://localhost:9000", bucket: "sprachpilot-dev" };

describe("avatar layout", () => {
  it("builds the private key, the published key, and the two prefixes", () => {
    expect(avatarSourceKey("user-1", "object-1")).toBe("private/avatars/user-1/object-1");
    expect(avatarPublishedKey("user-1", "abc123")).toBe("avatars/user-1/abc123.webp");
    expect(avatarPrefixes("user-1")).toEqual(["avatars/user-1/", "private/avatars/user-1/"]);
  });

  it("reads a published key back out of its public URL", () => {
    const key = avatarPublishedKey("user-1", "abc123");
    expect(avatarKeyFromUrl(publicObjectUrl(storage, key))).toBe(key);
  });

  it("rejects a URL that is not one of ours", () => {
    expect(avatarKeyFromUrl("https://evil.example/photo.webp")).toBeNull();
    expect(
      avatarKeyFromUrl(publicObjectUrl(storage, avatarSourceKey("user-1", "object-1"))),
    ).toBeNull();
    expect(avatarKeyFromUrl("not a url")).toBeNull();
  });
});
