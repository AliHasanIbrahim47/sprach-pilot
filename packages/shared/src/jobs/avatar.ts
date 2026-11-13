import { z } from "zod";

/** BullMQ queue that resizes avatars and strips metadata (SP-018). */
export const AVATAR_QUEUE_NAME = "avatar";

export const AVATAR_JOB_NAME = "process";

/** Stored objects are safe for a long-lived CDN cache because the key includes a content hash. */
export const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Reject anything larger before it is stored. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const avatarJobSchema = z.object({
  userId: z.string().min(1).max(64),
  sourceKey: z.string().min(1).max(256),
});

export type AvatarJob = z.infer<typeof avatarJobSchema>;
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];
