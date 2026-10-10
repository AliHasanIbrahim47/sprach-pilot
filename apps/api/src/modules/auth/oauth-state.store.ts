import type { RedisCounterClient } from "./login-throttle.js";

const AUTHORIZE_PREFIX = "auth:oauth:authorize:";
const LINK_PREFIX = "auth:oauth:link:";

export interface OAuthAuthorizeState {
  codeVerifier: string;
  nonce: string;
  returnTo: string | null;
  locale: string;
}

export interface OAuthLinkState {
  providerAccountId: string;
  email: string;
  displayName: string;
  userId: string;
}

export interface OAuthStateStore {
  saveAuthorize(state: string, data: OAuthAuthorizeState, ttlSeconds: number): Promise<void>;
  takeAuthorize(state: string): Promise<OAuthAuthorizeState | null>;
  saveLink(token: string, data: OAuthLinkState, ttlSeconds: number): Promise<void>;
  peekLink(token: string): Promise<OAuthLinkState | null>;
  takeLink(token: string): Promise<OAuthLinkState | null>;
}

export interface RedisKvClient extends RedisCounterClient {
  set(key: string, value: string, mode: "EX", seconds: number): Promise<string | null>;
}

export function createMemoryOAuthStateStore(options?: { now?: () => number }): OAuthStateStore {
  const now = options?.now ?? Date.now;
  const authorize = new Map<string, { data: OAuthAuthorizeState; expiresAt: number }>();
  const links = new Map<string, { data: OAuthLinkState; expiresAt: number }>();

  function readAuthorize(state: string): OAuthAuthorizeState | null {
    const entry = authorize.get(state);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      authorize.delete(state);
      return null;
    }
    return entry.data;
  }

  function readLink(token: string): OAuthLinkState | null {
    const entry = links.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      links.delete(token);
      return null;
    }
    return entry.data;
  }

  return {
    async saveAuthorize(state, data, ttlSeconds) {
      authorize.set(state, { data, expiresAt: now() + ttlSeconds * 1000 });
    },

    async takeAuthorize(state) {
      const data = readAuthorize(state);
      if (data) authorize.delete(state);
      return data;
    },

    async saveLink(token, data, ttlSeconds) {
      links.set(token, { data, expiresAt: now() + ttlSeconds * 1000 });
    },

    async peekLink(token) {
      return readLink(token);
    },

    async takeLink(token) {
      const data = readLink(token);
      if (data) links.delete(token);
      return data;
    },
  };
}

export function createRedisOAuthStateStore(redis: RedisKvClient): OAuthStateStore {
  return {
    async saveAuthorize(state, data, ttlSeconds) {
      await redis.set(`${AUTHORIZE_PREFIX}${state}`, JSON.stringify(data), "EX", ttlSeconds);
    },

    async takeAuthorize(state) {
      const key = `${AUTHORIZE_PREFIX}${state}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      await redis.del(key);
      return parseAuthorize(raw);
    },

    async saveLink(token, data, ttlSeconds) {
      await redis.set(`${LINK_PREFIX}${token}`, JSON.stringify(data), "EX", ttlSeconds);
    },

    async peekLink(token) {
      const raw = await redis.get(`${LINK_PREFIX}${token}`);
      if (!raw) return null;
      return parseLink(raw);
    },

    async takeLink(token) {
      const key = `${LINK_PREFIX}${token}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      await redis.del(key);
      return parseLink(raw);
    },
  };
}

function parseAuthorize(raw: string): OAuthAuthorizeState | null {
  try {
    const parsed = JSON.parse(raw) as OAuthAuthorizeState;
    if (
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.locale !== "string"
    ) {
      return null;
    }
    return {
      codeVerifier: parsed.codeVerifier,
      nonce: parsed.nonce,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : null,
      locale: parsed.locale,
    };
  } catch {
    return null;
  }
}

function parseLink(raw: string): OAuthLinkState | null {
  try {
    const parsed = JSON.parse(raw) as OAuthLinkState;
    if (
      typeof parsed.providerAccountId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
