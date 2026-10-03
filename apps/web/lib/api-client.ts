import { cookies } from "next/headers";

import { serverConfig } from "./server-config";

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfterSeconds: number | undefined = undefined,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
  /** When false, do not forward the incoming request cookies. Default true on the server. */
  forwardCookies?: boolean;
}

/**
 * Typed fetch wrapper for the Express API.
 * Prefer calling from Server Components, Route Handlers, or Server Actions.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { forwardCookies = true, ...init } = options;
  const headers = new Headers(init.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (forwardCookies) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((entry) => `${entry.name}=${entry.value}`)
      .join("; ");

    if (cookieHeader.length > 0) {
      headers.set("cookie", cookieHeader);
    }
  }

  const url = path.startsWith("http") ? path : `${serverConfig.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiClientError(
      `API request failed: ${response.status}`,
      response.status,
      body,
      readRetryAfterSeconds(response.headers.get("retry-after")),
    );
  }

  return body as T;
}

function readRetryAfterSeconds(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.ceil(seconds);
}
