import { ACCESS_TOKEN_COOKIE, AUTH_COPY, REFRESH_TOKEN_COOKIE } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { type AuthOverrides, createContainer } from "../src/container.js";
import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import type {
  GoogleIdentity,
  GoogleOAuthProvider,
} from "../src/modules/auth/google-oauth.provider.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import { createMemoryOAuthStateStore } from "../src/modules/auth/oauth-state.store.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

const REDIRECT_URI = "http://localhost:3000/api/auth/callback/google";

function createFakeHasher(): PasswordHasher {
  return {
    async hash(password) {
      return `hashed:${password}`;
    },
    async verify(passwordHash, password) {
      return passwordHash === `hashed:${password}`;
    },
    async dummyHash() {
      return "hashed:__dummy__";
    },
  };
}

function createMockGoogle(identity: GoogleIdentity): GoogleOAuthProvider & {
  lastAuthorize: { state: string; nonce: string } | null;
  failExchange: boolean;
} {
  const mock = {
    lastAuthorize: null as { state: string; nonce: string } | null,
    failExchange: false,
    async buildAuthorizationUrl(input: {
      state: string;
      nonce: string;
      codeChallenge: string;
      redirectUri: string;
    }) {
      mock.lastAuthorize = { state: input.state, nonce: input.nonce };
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("state", input.state);
      url.searchParams.set("nonce", input.nonce);
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("redirect_uri", input.redirectUri);
      return url;
    },
    async exchangeCallback(input: {
      callbackUrl: URL;
      codeVerifier: string;
      expectedState: string;
      expectedNonce: string;
    }) {
      if (mock.failExchange) {
        const { UnauthorizedError } = await import("@sprachpilot/shared");
        throw new UnauthorizedError(AUTH_COPY.oauthFailed);
      }
      if (input.callbackUrl.searchParams.get("state") !== input.expectedState) {
        const { UnauthorizedError } = await import("@sprachpilot/shared");
        throw new UnauthorizedError(AUTH_COPY.oauthStateInvalid);
      }
      if (!input.codeVerifier || !input.expectedNonce) {
        const { UnauthorizedError } = await import("@sprachpilot/shared");
        throw new UnauthorizedError(AUTH_COPY.oauthFailed);
      }
      return identity;
    },
  };
  return mock;
}

function createOAuthApp(
  options: {
    identity?: GoogleIdentity;
    google?: GoogleOAuthProvider | null;
    env?: NodeJS.ProcessEnv;
  } = {},
) {
  const users = createMemoryUserRepository();
  const accounts = createMemoryAccountRepository();
  const email = createTestEmailPorts();
  const metrics = createAuthMetrics();
  const oauthState = createMemoryOAuthStateStore();
  const identity =
    options.identity ??
    ({
      providerAccountId: "google-sub-1",
      email: "learner@example.com",
      emailVerified: true,
      displayName: "Ada Learner",
    } satisfies GoogleIdentity);
  const google = options.google ?? createMockGoogle(identity);

  const auth: AuthOverrides = {
    users,
    accounts,
    sessions: createMemorySessionRepository(),
    throttle: createMemoryLoginThrottle(),
    metrics,
    hasher: createFakeHasher(),
    clock: () => new Date("2026-10-10T12:00:00.000Z"),
    emailTokens: email.emailTokens,
    emailSends: email.emailSends,
    emailQueue: email.emailQueue,
    oauthState,
    googleOAuth: google,
  };

  const config = loadConfig(
    createValidApiEnv({
      FEATURE_GOOGLE_OAUTH: "true",
      GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "google-oauth-secret",
      GOOGLE_OAUTH_REDIRECT_URI: REDIRECT_URI,
      ...options.env,
    }),
  );
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth,
  });

  return {
    app: createApp(container),
    users,
    accounts,
    google: google as ReturnType<typeof createMockGoogle>,
    container,
  };
}

async function startAndCallback(
  app: ReturnType<typeof createApp>,
  google: ReturnType<typeof createMockGoogle>,
  code = "auth-code",
  stateOverride?: string,
) {
  const start = await request(app).get("/v1/auth/oauth/google").query({ locale: "en" });
  expect(start.status).toBe(302);
  const state = stateOverride ?? google.lastAuthorize?.state;
  expect(state).toBeTruthy();

  return request(app).post("/v1/auth/oauth/google/callback").send({ code, state });
}

describe("Google OAuth (SP-015)", () => {
  it("creates a verified learner and sets session cookies for a new Google user", async () => {
    const { app, users, accounts, google } = createOAuthApp();

    const response = await startAndCallback(app, google);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("authenticated");
    expect(response.body.needsOnboarding).toBe(true);
    expect(response.headers["set-cookie"]?.join(";") ?? "").toContain(ACCESS_TOKEN_COOKIE);
    expect(response.headers["set-cookie"]?.join(";") ?? "").toContain(REFRESH_TOKEN_COOKIE);

    const user = users.records()[0];
    expect(user?.email).toBe("learner@example.com");
    expect(user?.passwordHash).toBeNull();
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(accounts.records()).toHaveLength(1);
  });

  it("logs in an existing Google-linked user without creating a second account", async () => {
    const { app, users, accounts, google } = createOAuthApp();

    const first = await startAndCallback(app, google);
    expect(first.status).toBe(200);
    expect(users.records()).toHaveLength(1);

    const second = await startAndCallback(app, google);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("authenticated");
    expect(users.records()).toHaveLength(1);
    expect(accounts.records()).toHaveLength(1);
  });

  it("rejects a tampered state and does not create a session", async () => {
    const { app, users, google } = createOAuthApp();

    const start = await request(app).get("/v1/auth/oauth/google");
    expect(start.status).toBe(302);

    const response = await request(app)
      .post("/v1/auth/oauth/google/callback")
      .send({ code: "auth-code", state: "tampered-state-value" });

    expect(response.status).toBe(401);
    expect(response.body.detail).toBe(AUTH_COPY.oauthStateInvalid);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(users.records()).toHaveLength(0);
    expect(google.lastAuthorize?.state).toBeTruthy();
  });

  it("asks for password confirmation when Google email matches a password account", async () => {
    const { app, users, accounts, google } = createOAuthApp();

    await users.createWithConsent({
      email: "learner@example.com",
      passwordHash: "hashed:correct-horse-battery",
      displayName: "Ada",
      uiLocale: "en",
      consents: [],
    });

    const callback = await startAndCallback(app, google);
    expect(callback.status).toBe(200);
    expect(callback.body.status).toBe("link_required");
    expect(callback.body.email).toBe("learner@example.com");
    expect(callback.headers["set-cookie"]).toBeUndefined();
    expect(accounts.records()).toHaveLength(0);

    const wrong = await request(app).post("/v1/auth/oauth/google/link").send({
      linkToken: callback.body.linkToken,
      password: "wrong-password",
    });
    expect(wrong.status).toBe(401);

    const linked = await request(app).post("/v1/auth/oauth/google/link").send({
      linkToken: callback.body.linkToken,
      password: "correct-horse-battery",
    });
    expect(linked.status).toBe(200);
    expect(linked.body.status).toBe("authenticated");
    expect(linked.headers["set-cookie"]?.join(";") ?? "").toContain(ACCESS_TOKEN_COOKIE);
    expect(accounts.records()).toHaveLength(1);
  });

  it("unlinks Google when the user has a password", async () => {
    const { app, users, accounts, google } = createOAuthApp();

    await users.createWithConsent({
      email: "learner@example.com",
      passwordHash: "hashed:correct-horse-battery",
      displayName: "Ada",
      uiLocale: "en",
      emailVerifiedAt: new Date(),
      consents: [],
    });

    const callback = await startAndCallback(app, google);
    const linked = await request(app).post("/v1/auth/oauth/google/link").send({
      linkToken: callback.body.linkToken,
      password: "correct-horse-battery",
    });
    const cookie = linked.headers["set-cookie"];
    expect(accounts.records()).toHaveLength(1);

    const unlink = await request(app).delete("/v1/auth/oauth/google").set("Cookie", cookie);
    expect(unlink.status).toBe(204);
    expect(accounts.records()).toHaveLength(0);

    const me = await request(app).get("/v1/auth/me").set("Cookie", cookie);
    expect(me.body.googleLinked).toBe(false);
    expect(me.body.hasPassword).toBe(true);
  });

  it("returns forbidden when Google OAuth is disabled", async () => {
    const { app } = createOAuthApp({
      env: { FEATURE_GOOGLE_OAUTH: "false" },
    });

    const response = await request(app).get("/v1/auth/oauth/google");
    expect(response.status).toBe(403);
    expect(response.body.detail).toBe(AUTH_COPY.oauthDisabled);
  });
});
