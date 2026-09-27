import { cookies } from "next/headers";

import { appConfig } from "./config";

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
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

  const url = path.startsWith("http") ? path : `${appConfig.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiClientError(`API request failed: ${response.status}`, response.status, body);
  }

  return body as T;
}
