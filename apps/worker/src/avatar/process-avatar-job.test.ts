import { AVATAR_CACHE_CONTROL } from "@sprachpilot/shared";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createAvatarProcessor, createMemoryAvatarStorage } from "./process-avatar-job.js";

describe("avatar processing", () => {
  it("stores a resized image with no EXIF metadata and a public cache header", async () => {
    const jpeg = await sharp({
      create: { width: 16, height: 8, channels: 3, background: { r: 20, g: 80, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    const withGps = await sharp(jpeg)
      .withMetadata({
        exif: {
          IFD0: { Copyright: "GPSLatitude" },
          GPS: { GPSLatitudeRef: "N", GPSLatitude: "52/1 31/1 0/1" },
        },
      })
      .jpeg()
      .toBuffer();
    const sourceMeta = await sharp(withGps).metadata();
    expect(sourceMeta.exif).toBeDefined();
    expect(Buffer.from(sourceMeta.exif ?? []).includes(Buffer.from("GPSLatitude"))).toBe(true);

    const storage = createMemoryAvatarStorage({
      endpoint: "http://localhost:9000",
      bucket: "sprachpilot-dev",
    });
    await storage.put({
      key: "avatars/incoming/user-1/source",
      body: withGps,
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });

    const saved: { userId: string; avatarUrl: string }[] = [];
    await createAvatarProcessor({
      storage,
      async saveAvatarUrl(userId, avatarUrl) {
        saved.push({ userId, avatarUrl });
      },
    })({ data: { userId: "user-1", sourceKey: "avatars/incoming/user-1/source" } });

    expect(storage.objects().has("avatars/incoming/user-1/source")).toBe(false);
    const stored = [...storage.objects().values()][0];
    expect(stored?.contentType).toBe("image/webp");
    expect(stored?.cacheControl).toBe(AVATAR_CACHE_CONTROL);
    expect(stored?.body.includes(Buffer.from("GPSLatitude"))).toBe(false);
    const metadata = await sharp(stored?.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect(saved).toEqual([
      {
        userId: "user-1",
        avatarUrl: expect.stringMatching(
          /^http:\/\/localhost:9000\/sprachpilot-dev\/avatars\/user-1\/[a-f0-9]{32}\.webp$/,
        ),
      },
    ]);
  });

  it("deletes the original when the bytes are not an image", async () => {
    const storage = createMemoryAvatarStorage({
      endpoint: "http://localhost:9000",
      bucket: "sprachpilot-dev",
    });
    await storage.put({
      key: "private/avatars/user-1/source",
      body: Buffer.from("not a photo"),
      contentType: "application/octet-stream",
      cacheControl: "private, no-store",
    });

    await expect(
      createAvatarProcessor({
        storage,
        async saveAvatarUrl() {
          throw new Error("should not publish");
        },
      })({ data: { userId: "user-1", sourceKey: "private/avatars/user-1/source" } }),
    ).rejects.toThrow("invalid avatar image");
    expect(storage.objects().has("private/avatars/user-1/source")).toBe(false);
  });
});
