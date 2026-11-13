import { MAX_AVATAR_BYTES } from "@sprachpilot/shared";
import sharp from "sharp";

const AVATAR_EDGE_PX = 512;

export class AvatarImageError extends Error {
  constructor(reason: "too_large" | "not_image") {
    super(reason);
    this.name = "AvatarImageError";
  }
}

/**
 * Orients the photo, shrinks the long edge to 512px, and writes WebP without metadata.
 * Sharp drops EXIF, including GPS, unless withMetadata() is called. It is not.
 */
export async function renderAvatar(
  bytes: Buffer,
): Promise<{ body: Buffer; contentType: "image/webp" }> {
  if (bytes.length > MAX_AVATAR_BYTES) throw new AvatarImageError("too_large");

  try {
    const body = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { body, contentType: "image/webp" };
  } catch (error) {
    if (error instanceof AvatarImageError) throw error;
    throw new AvatarImageError("not_image");
  }
}
