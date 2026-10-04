import { createPrivateKey, createPublicKey, type KeyObject, sign, verify } from "node:crypto";

export interface PublicSigningKey {
  kid: string;
  pem: string;
}

export interface Ed25519Jwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  use: "sig";
  alg: "EdDSA";
}

export interface SigningKeySet {
  activeKid: string;
  privateKey: KeyObject;
  publicKeys: ReadonlyMap<string, KeyObject>;
  jwks: { keys: Ed25519Jwk[] };
}

const PROBE = Buffer.from("sprachpilot-signing-key-check");

/**
 * Load Ed25519 keys from PEM. The active private key must match its public key.
 * Verification keys stay in memory so access-token checks do not touch the database.
 */
export function loadSigningKeys(input: {
  activeKid: string;
  privateKeyPem: string;
  publicKeys: readonly PublicSigningKey[];
}): SigningKeySet {
  if (input.publicKeys.length === 0) {
    throw new Error("At least one JWT public key is required");
  }

  const publicKeys = new Map<string, KeyObject>();
  const jwks: Ed25519Jwk[] = [];

  for (const entry of input.publicKeys) {
    if (publicKeys.has(entry.kid)) {
      throw new Error(`Duplicate JWT kid "${entry.kid}"`);
    }
    const publicKey = createPublicKey(entry.pem);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new Error(`JWT public key "${entry.kid}" must be Ed25519`);
    }
    publicKeys.set(entry.kid, publicKey);
    jwks.push(toPublicJwk(publicKey, entry.kid));
  }

  const activePublic = publicKeys.get(input.activeKid);
  if (!activePublic) {
    throw new Error(`JWT active kid "${input.activeKid}" is not in the public key set`);
  }

  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("JWT private key must be Ed25519");
  }

  const signature = sign(null, PROBE, privateKey);
  if (!verify(null, PROBE, activePublic, signature)) {
    throw new Error("JWT private key does not match the active public key");
  }

  return {
    activeKid: input.activeKid,
    privateKey,
    publicKeys,
    jwks: { keys: jwks },
  };
}

function toPublicJwk(publicKey: KeyObject, kid: string): Ed25519Jwk {
  const der = publicKey.export({ type: "spki", format: "der" });
  if (!Buffer.isBuffer(der) || der.length < 32) {
    throw new Error(`JWT public key "${kid}" is not a valid Ed25519 SPKI key`);
  }
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: der.subarray(der.length - 32).toString("base64url"),
    kid,
    use: "sig",
    alg: "EdDSA",
  };
}
