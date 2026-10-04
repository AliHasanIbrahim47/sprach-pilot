import { generateKeyPairSync } from "node:crypto";

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { createTokenService, type TokenService } from "./token.service.js";

function pem(
  key:
    | ReturnType<typeof generateKeyPairSync>["publicKey"]
    | ReturnType<typeof generateKeyPairSync>["privateKey"],
  type: "spki" | "pkcs8",
): string {
  return key.export({ type, format: "pem" }).toString();
}

function createService(
  pair: ReturnType<typeof generateKeyPairSync>,
  extra: { kid: string; pem: string }[] = [],
  activeKid = "active",
): TokenService {
  return createTokenService({
    activeKid,
    privateKeyPem: pem(pair.privateKey, "pkcs8"),
    publicKeys: [{ kid: activeKid, pem: pem(pair.publicKey, "spki") }, ...extra],
    refreshPepper: "token-service-pepper-value",
  });
}

describe("token service", () => {
  it("puts only sub, role, sid, iat, and exp in the access token", async () => {
    const service = createService(generateKeyPairSync("ed25519"));
    const now = new Date();
    const token = await service.signAccessToken(
      { sub: "user-1", role: "learner", sid: "family-1" },
      now,
    );

    const payload = token.split(".")[1];
    if (!payload) throw new Error("missing payload");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<
      string,
      unknown
    >;

    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "role", "sid", "sub"]);
    expect(claims).toMatchObject({ sub: "user-1", role: "learner", sid: "family-1" });
    expect(JSON.stringify(claims)).not.toContain("email");
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      sub: "user-1",
      role: "learner",
      sid: "family-1",
    });
  });

  it("rejects an expired access token without a database lookup", async () => {
    const service = createService(generateKeyPairSync("ed25519"));
    const token = await service.signAccessToken(
      { sub: "user-1", role: "learner", sid: "family-1" },
      new Date(Date.now() - 16 * 60 * 1000),
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow(/invalid access token/);
  });

  it("verifies a token signed by a retired key and rejects an unknown kid", async () => {
    const retired = generateKeyPairSync("ed25519");
    const active = generateKeyPairSync("ed25519");
    const retiredService = createService(retired, [], "retired");
    const rotatedService = createTokenService({
      activeKid: "active",
      privateKeyPem: pem(active.privateKey, "pkcs8"),
      publicKeys: [
        { kid: "active", pem: pem(active.publicKey, "spki") },
        { kid: "retired", pem: pem(retired.publicKey, "spki") },
      ],
      refreshPepper: "token-service-pepper-value",
    });
    const onlyActive = createService(active);

    const token = await retiredService.signAccessToken(
      { sub: "user-1", role: "admin", sid: "family-1" },
      new Date(),
    );

    await expect(rotatedService.verifyAccessToken(token)).resolves.toMatchObject({
      sub: "user-1",
      role: "admin",
    });
    await expect(onlyActive.verifyAccessToken(token)).rejects.toThrow(/invalid access token/);
    expect(rotatedService.publicJwks().keys.map((key) => key.kid)).toEqual(["active", "retired"]);
    expect(JSON.stringify(rotatedService.publicJwks())).not.toContain("PRIVATE");
  });

  it("rejects an access token that carries an extra claim", async () => {
    const pair = generateKeyPairSync("ed25519");
    const service = createService(pair);
    const token = await new SignJWT({ role: "learner", sid: "family-1", email: "ada@example.com" })
      .setProtectedHeader({ alg: "EdDSA", kid: "active", typ: "JWT" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(pair.privateKey);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(/invalid access token/);
  });

  it("hashes refresh tokens so the stored value is not the secret", () => {
    const service = createService(generateKeyPairSync("ed25519"));
    const token = service.createRefreshToken();
    const hash = service.hashRefreshToken(token);

    expect(token).not.toBe(hash);
    expect(hash).toHaveLength(64);
    expect(service.hashRefreshToken(token)).toBe(hash);
  });
});
