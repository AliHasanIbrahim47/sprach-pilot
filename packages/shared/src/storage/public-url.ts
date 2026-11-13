/**
 * Path-style object URL. CDN cache headers live on the object itself.
 */
export function publicObjectUrl(
  storage: { endpoint: string; bucket: string },
  key: string,
): string {
  const endpoint = storage.endpoint.replace(/\/$/, "");
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${endpoint}/${storage.bucket}/${encoded}`;
}
