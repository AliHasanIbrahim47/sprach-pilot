import { createS3Bucket } from "@sprachpilot/s3";
import { AVATAR_PRIVATE_PREFIX, AVATAR_PUBLIC_PREFIX, ValidationError } from "@sprachpilot/shared";

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
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/** Avatars and GDPR archives. Other prefixes are rejected. */
const OBJECT_PREFIXES = [AVATAR_PUBLIC_PREFIX, AVATAR_PRIVATE_PREFIX, "privacy/exports"] as const;
const OBJECT_KEY = new RegExp(
  `^(?:${OBJECT_PREFIXES.map(escapeRegExp).join("|")})/[A-Za-z0-9][A-Za-z0-9._/-]{0,220}$`,
);

export function createMemoryObjectStorage(): ObjectStorage {
  const objects = new Map<string, StoredObject>();
  return {
    async put(input) {
      assertObjectKey(input.key);
      objects.set(input.key, {
        body: Buffer.from(input.body),
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      });
    },
    async get(key) {
      assertObjectKey(key);
      const stored = objects.get(key);
      if (!stored) return null;
      return { ...stored, body: Buffer.from(stored.body) };
    },
    async delete(key) {
      assertObjectKey(key);
      objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
  };
}

export function createS3ObjectStorage(config: ApiConfig): ObjectStorage {
  const bucket = createS3Bucket(config.s3);
  return {
    async put(input) {
      assertObjectKey(input.key);
      await bucket.put(input);
    },
    async get(key) {
      assertObjectKey(key);
      return bucket.get(key);
    },
    async delete(key) {
      assertObjectKey(key);
      await bucket.delete(key);
    },
    async list(prefix) {
      return bucket.list(prefix);
    },
  };
}

function assertObjectKey(key: string): void {
  if (!OBJECT_KEY.test(key) || key.includes("..")) {
    throw new ValidationError({ detail: "Invalid object location." });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
