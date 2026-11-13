import { createHash } from "node:crypto";

import { AVATAR_CACHE_CONTROL, avatarJobSchema, publicObjectUrl } from "@sprachpilot/shared";
import { UnrecoverableError } from "bullmq";

import { AvatarImageError, renderAvatar } from "./render-avatar.js";

export interface AvatarObject {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export interface AvatarStorage {
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  get(key: string): Promise<AvatarObject | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export interface AvatarProcessorDependencies {
  storage: AvatarStorage;
  saveAvatarUrl(userId: string, avatarUrl: string): Promise<void>;
}

/**
 * Resizes the uploaded photo, strips metadata, and publishes a cacheable object.
 */
export function createAvatarProcessor(dependencies: AvatarProcessorDependencies) {
  const { storage, saveAvatarUrl } = dependencies;

  return async (job: { data: unknown }): Promise<void> => {
    const parsed = avatarJobSchema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError("invalid avatar job");

    const source = await storage.get(parsed.data.sourceKey);
    if (!source) throw new UnrecoverableError("missing avatar source");

    let rendered: { body: Buffer; contentType: "image/webp" };
    try {
      rendered = await renderAvatar(source.body);
    } catch (error) {
      if (error instanceof AvatarImageError) {
        await storage.delete(parsed.data.sourceKey);
        throw new UnrecoverableError("invalid avatar image");
      }
      throw error;
    }

    const hash = createHash("sha256").update(rendered.body).digest("hex").slice(0, 32);
    const targetKey = `avatars/${parsed.data.userId}/${hash}.webp`;
    await storage.put({
      key: targetKey,
      body: rendered.body,
      contentType: rendered.contentType,
      cacheControl: AVATAR_CACHE_CONTROL,
    });
    await storage.delete(parsed.data.sourceKey);
    await saveAvatarUrl(parsed.data.userId, storage.publicUrl(targetKey));
  };
}

export function createMemoryAvatarStorage(storage: {
  endpoint: string;
  bucket: string;
}): AvatarStorage & { objects(): ReadonlyMap<string, AvatarObject> } {
  const objects = new Map<string, AvatarObject>();
  return {
    async put(input) {
      objects.set(input.key, {
        body: Buffer.from(input.body),
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      });
    },
    async get(key) {
      const stored = objects.get(key);
      return stored ? { ...stored, body: Buffer.from(stored.body) } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    publicUrl(key) {
      return publicObjectUrl(storage, key);
    },
    objects() {
      return objects;
    },
  };
}
