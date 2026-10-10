import { generateKeyPairSync } from "node:crypto";

import { ACCESS_TOKEN_COOKIE, AUTH_COPY } from "@sprachpilot/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createErrorHandler } from "../../middleware/error-handler.js";
import { createMemoryUserRepository } from "./auth.repository.js";
import { createRequireAuth } from "./require-auth.js";
import { createRequireVerifiedEmail } from "./require-verified.js";
import { createTokenService } from "./token.service.js";

const signingKeys = generateKeyPairSync("ed25519");
const tokens = createTokenService({
  activeKid: "unit-test",
  privateKeyPem: signingKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  publicKeys: [
    {
      kid: "unit-test",
      pem: signingKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
    },
  ],
  refreshPepper: "unit-test-refresh-pepper",
});

describe("requireVerifiedEmail", () => {
  it("allows sign-in routes to stay open and blocks unverified access to a protected feature", async () => {
    const users = createMemoryUserRepository();
    const created = await users.createWithConsent({
      email: "learner@example.com",
      passwordHash: "hashed",
      displayName: "Ada",
      uiLocale: "en",
      consents: [],
    });
    if (created.status !== "created") throw new Error("expected a user");

    const app = express();
    app.get(
      "/uploads",
      createRequireAuth(tokens),
      createRequireVerifiedEmail(users),
      (_req, res) => {
        res.status(204).end();
      },
    );
    app.use(createErrorHandler({ nodeEnv: "test" }));

    const accessToken = await tokens.signAccessToken(
      { sub: created.id, role: "learner", sid: "family-1" },
      new Date(),
    );
    const cookie = `${ACCESS_TOKEN_COOKIE}=${accessToken}`;

    const blocked = await request(app).get("/uploads").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.detail).toBe(AUTH_COPY.emailVerificationRequired);

    await users.markEmailVerified(created.id, new Date());
    const allowed = await request(app).get("/uploads").set("Cookie", cookie);
    expect(allowed.status).toBe(204);
  });
});
