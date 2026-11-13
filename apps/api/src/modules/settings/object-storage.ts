import { createS3Bucket, type S3Location } from "@sprachpilot/s3";
import { publicObjectUrl, ValidationError } from "@sprachpilot/shared";

import type { ApiConfig } from "../../config.js";

export interface StoredObject {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export interface ObjectStorage {
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Published photos live under avatars/. Originals stay under private/avatars/. */
const AVATAR_KEY = /^(?:avatars|private\/avatars)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,220}$/;

export function createMemoryObjectStorage(): ObjectStorage {
  const objects = new Map<string, StoredObject>();
  return {
    async put(input) {
      assertAvatarKey(input.key);
      objects.set(input.key, {
        body: Buffer.from(input.body),
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      });
    },
    async delete(key) {
      assertAvatarKey(key);
      objects.delete(key);
    },
  };
}

export function createS3ObjectStorage(config: ApiConfig): ObjectStorage {
  const bucket = createS3Bucket(config.s3);
  return {
    async put(input) {
      assertAvatarKey(input.key);
      await bucket.put(input);
    },
    async delete(key) {
      assertAvatarKey(key);
      await bucket.delete(key);
    },
  };
}

export function avatarPublicUrl(storage: S3Location, key: string): string {
  return publicObjectUrl(storage, key);
}

function assertAvatarKey(key: string): void {
  if (!AVATAR_KEY.test(key) || key.includes("..")) {
    throw new ValidationError({ detail: "Invalid avatar location." });
  }
}
