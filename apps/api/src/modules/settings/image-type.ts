import { SETTINGS_COPY, ValidationError } from "@sprachpilot/shared";

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND = Buffer.from("IEND");

/**
 * True only for a complete JPEG, PNG, GIF, or WEBP.
 * A bare signature is not enough: truncated files are rejected here.
 */
export function isAvatarImage(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  return isJpeg(bytes) || isPng(bytes) || isGif(bytes) || isWebp(bytes);
}

export function invalidAvatar(): ValidationError {
  return new ValidationError({
    detail: SETTINGS_COPY.avatarRejected,
    errors: [{ field: "avatar", code: "invalid_avatar", message: SETTINGS_COPY.avatarRejected }],
  });
}

function isJpeg(bytes: Buffer): boolean {
  return (
    startsWith(bytes, JPEG) && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
  );
}

function isPng(bytes: Buffer): boolean {
  return startsWith(bytes, PNG) && bytes.includes(IEND);
}

function isGif(bytes: Buffer): boolean {
  const header = bytes.subarray(0, 6).toString("ascii");
  return (header === "GIF87a" || header === "GIF89a") && bytes[bytes.length - 1] === 0x3b;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP" &&
    bytes.length >= 16
  );
}

function startsWith(bytes: Buffer, prefix: Buffer): boolean {
  return bytes.subarray(0, prefix.length).equals(prefix);
}
