import { createHmac, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { type Ed25519Jwk, loadSigningKeys, type PublicSigningKey } from "./signing-keys.js";

/** Short-lived access token. Verification uses the in-memory public key only. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Opaque refresh token lifetime. Rotation slides this window. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ACCESS_CLAIMS = new Set(["sub", "role", "sid", "iat", "exp"]);

export interface AccessTokenClaims {
  sub: string;
  role: string;
  sid: string;
  iat: number;
  exp: number;
}

export interface TokenService {
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  signAccessToken(
    claims: Pick<AccessTokenClaims, "sub" | "role" | "sid">,
    now: Date,
  ): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  createRefreshToken(): string;
  hashRefreshToken(token: string): string;
  publicJwks(): { keys: Ed25519Jwk[] };
}

export interface TokenServiceOptions {
  activeKid: string;
  privateKeyPem: string;
  publicKeys: readonly PublicSigningKey[];
  refreshPepper: string;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
}

/**
 * Access tokens are EdDSA JWTs. Refresh tokens are random and stored only as an HMAC.
 * `verifyAccessToken` does not query the database (NFR-2).
 */
export function createTokenService(options: TokenServiceOptions): TokenService {
  const keys = loadSigningKeys(options);
  const accessTtlSeconds = options.accessTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const refreshTtlSeconds = options.refreshTtlSeconds ?? REFRESH_TOKEN_TTL_SECONDS;

  return {
    accessTtlSeconds,
    refreshTtlSeconds,

    async signAccessToken(claims, now) {
      const issuedAtSeconds = Math.floor(now.getTime() / 1000);
      return new SignJWT({ role: claims.role, sid: claims.sid })
        .setProtectedHeader({ alg: "EdDSA", kid: keys.activeKid, typ: "JWT" })
        .setSubject(claims.sub)
        .setIssuedAt(issuedAtSeconds)
        .setExpirationTime(issuedAtSeconds + accessTtlSeconds)
        .sign(keys.privateKey);
    },

    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(
          token,
          async (header) => {
            if (header.alg !== "EdDSA" || typeof header.kid !== "string") {
              throw new Error("invalid access token");
            }
            const key = keys.publicKeys.get(header.kid);
            if (!key) throw new Error("invalid access token");
            return key;
          },
          { algorithms: ["EdDSA"], clockTolerance: 0 },
        );
        return readAccessClaims(payload);
      } catch {
        throw new Error("invalid access token");
      }
    },

    createRefreshToken() {
      return randomBytes(32).toString("base64url");
    },

    hashRefreshToken(token) {
      return createHmac("sha256", options.refreshPepper).update(token).digest("hex");
    },

    publicJwks() {
      return keys.jwks;
    },
  };
}

function readAccessClaims(payload: Record<string, unknown>): AccessTokenClaims {
  for (const key of Object.keys(payload)) {
    if (!ACCESS_CLAIMS.has(key)) throw new Error("invalid access token");
  }

  const { sub, role, sid, iat, exp } = payload;
  if (typeof sub !== "string" || sub.length === 0) throw new Error("invalid access token");
  if (typeof role !== "string" || role.length === 0) throw new Error("invalid access token");
  if (typeof sid !== "string" || sid.length === 0) throw new Error("invalid access token");
  if (typeof iat !== "number" || typeof exp !== "number") throw new Error("invalid access token");

  return { sub, role, sid, iat, exp };
}
