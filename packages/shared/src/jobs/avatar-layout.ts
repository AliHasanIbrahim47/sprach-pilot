/** Published photos. */
export const AVATAR_PUBLIC_PREFIX = "avatars";

/** Originals waiting to be resized. */
export const AVATAR_PRIVATE_PREFIX = "private/avatars";

export function avatarSourceKey(userId: string, objectId: string): string {
  return `${AVATAR_PRIVATE_PREFIX}/${userId}/${objectId}`;
}

export function avatarPublishedKey(userId: string, contentHash: string): string {
  return `${AVATAR_PUBLIC_PREFIX}/${userId}/${contentHash}.webp`;
}

/** Directories privacy lists for one learner's photos. */
export function avatarPrefixes(userId: string): readonly [string, string] {
  return [`${AVATAR_PUBLIC_PREFIX}/${userId}/`, `${AVATAR_PRIVATE_PREFIX}/${userId}/`];
}

/** Published key embedded in a public avatar URL. */
export function avatarKeyFromUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;

  let pathname: string;
  try {
    pathname = new URL(avatarUrl).pathname;
  } catch {
    return null;
  }

  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const marker = `/${AVATAR_PUBLIC_PREFIX}/`;
  const index = decoded.lastIndexOf(marker);
  if (index === -1) return null;
  if (decoded.slice(0, index).endsWith("/private")) return null;

  const key = decoded.slice(index + 1);
  return isPublishedKey(key) ? key : null;
}

function isPublishedKey(key: string): boolean {
  if (key.includes("..") || key.includes("\\")) return false;
  const [prefix, userId, file] = key.split("/");
  if (prefix !== AVATAR_PUBLIC_PREFIX || key.split("/").length !== 3) return false;
  if (!userId || !file?.endsWith(".webp")) return false;
  return (
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(userId) && /^[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/.test(file)
  );
}
