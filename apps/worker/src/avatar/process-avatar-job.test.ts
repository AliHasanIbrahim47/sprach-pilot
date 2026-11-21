import { AVATAR_CACHE_CONTROL, avatarPublishedKey, avatarSourceKey } from "@sprachpilot/shared";
import { UnrecoverableError } from "bullmq";
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
    const sourceKey = avatarSourceKey("user-1", "source");
    await storage.put({
      key: sourceKey,
      body: withGps,
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });

    const saved: { userId: string; avatarUrl: string }[] = [];
    await createAvatarProcessor({
      storage,
      async saveAvatarUrl(userId, avatarUrl) {
        saved.push({ userId, avatarUrl });
        return true;
      },
    })({ data: { userId: "user-1", sourceKey } });

    expect(storage.objects().has(sourceKey)).toBe(false);
    const stored = [...storage.objects().values()][0];
    expect(stored?.contentType).toBe("image/webp");
    expect(stored?.cacheControl).toBe(AVATAR_CACHE_CONTROL);
    expect(stored?.body.includes(Buffer.from("GPSLatitude"))).toBe(false);
    const metadata = await sharp(stored?.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    const published = [...storage.objects().keys()];
    expect(published).toHaveLength(1);
    const hash = published[0]?.split("/")[2]?.replace(/\.webp$/, "") ?? "";
    expect(published[0]).toBe(avatarPublishedKey("user-1", hash));
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
    const sourceKey = avatarSourceKey("user-1", "source");
    await storage.put({
      key: sourceKey,
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
      })({ data: { userId: "user-1", sourceKey } }),
    ).rejects.toThrow("invalid avatar image");
    expect(storage.objects().has(sourceKey)).toBe(false);
  });

  it("deletes both objects when the profile refuses the photo", async () => {
    const storage = createMemoryAvatarStorage({
      endpoint: "http://localhost:9000",
      bucket: "sprachpilot-dev",
    });
    const sourceKey = avatarSourceKey("user-1", "source");
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    await storage.put({
      key: sourceKey,
      body: jpeg,
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });

    await createAvatarProcessor({
      storage,
      async saveAvatarUrl() {
        return false;
      },
    })({ data: { userId: "user-1", sourceKey } });

    expect(storage.objects().size).toBe(0);
  });

  it("leaves both objects when saving the photo throws", async () => {
    const storage = createMemoryAvatarStorage({
      endpoint: "http://localhost:9000",
      bucket: "sprachpilot-dev",
    });
    const sourceKey = avatarSourceKey("user-1", "source");
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    await storage.put({
      key: sourceKey,
      body: jpeg,
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });

    await expect(
      createAvatarProcessor({
        storage,
        async saveAvatarUrl() {
          throw new Error("database unavailable");
        },
      })({ data: { userId: "user-1", sourceKey } }),
    ).rejects.toThrow("database unavailable");

    expect(storage.objects().has(sourceKey)).toBe(true);
    expect([...storage.objects().keys()].some((key) => key.endsWith(".webp"))).toBe(true);
  });

  it("fails without a retry when the original is missing", async () => {
    const storage = createMemoryAvatarStorage({
      endpoint: "http://localhost:9000",
      bucket: "sprachpilot-dev",
    });

    await expect(
      createAvatarProcessor({
        storage,
        async saveAvatarUrl() {
          return true;
        },
      })({ data: { userId: "user-1", sourceKey: avatarSourceKey("user-1", "missing") } }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
