import { generateKeyPairSync } from "node:crypto";

import {
  AUTH_COPY,
  ConflictError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { createMemoryEmailQueue } from "../email/email-queue.js";
import { createMemoryEmailSendLimiter } from "../email/email-rate-limit.js";
import { createMemoryAccountRepository } from "./account.repository.js";
import { createMemoryUserRepository } from "./auth.repository.js";
import {
  type AuthLogger,
  type AuthServiceDependencies,
  createAuthService,
} from "./auth.service.js";
import { createMemoryEmailTokenRepository } from "./email-token.repository.js";
import { createEmailTokenCodec } from "./email-token-codec.js";
import { hashIp } from "./ip-hash.js";
import { createMemoryLoginThrottle } from "./login-throttle.js";
import { createAuthMetrics } from "./metrics.js";
import type { PasswordHasher } from "./password-hasher.js";
import { createMemorySessionRepository } from "./session.repository.js";
import { createTokenService } from "./token.service.js";

const signingKeys = generateKeyPairSync("ed25519");
const tokenService = createTokenService({
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

const SECRET = "test-ip-hash-secret";
const NOW = new Date("2026-10-03T07:00:00.000Z");
const IP = "203.0.113.10";

const validRegistration = {
  email: "Learner@Example.com",
  password: "correct-horse-battery",
  displayName: "Ada",
  acceptedTerms: true as const,
};

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

function createHarness(overrides: Partial<AuthServiceDependencies> = {}) {
  const users = createMemoryUserRepository();
  const emailQueue = createMemoryEmailQueue();
  const emailTokens = createMemoryEmailTokenRepository();
  const logs: string[] = [];
  const logger: AuthLogger = {
    info(message, meta) {
      logs.push(JSON.stringify({ message, meta }));
    },
    error(message, meta) {
      logs.push(JSON.stringify({ message, meta }));
    },
  };
  const metrics = createAuthMetrics();
  const sessions = createMemorySessionRepository();
  const dependencies: AuthServiceDependencies = {
    users,
    accounts: createMemoryAccountRepository(),
    sessions,
    tokens: tokenService,
    throttle: createMemoryLoginThrottle(),
    emailTokens,
    emailCodec: createEmailTokenCodec("unit-test-refresh-pepper"),
    emailSends: createMemoryEmailSendLimiter(),
    emailQueue,
    webPublicUrl: "http://localhost:3000",
    metrics,
    hasher: createFakeHasher(),
    clock: () => NOW,
    ipHashSecret: SECRET,
    registrationEnabled: true,
    logger,
    ...overrides,
  };
  const service = createAuthService(dependencies);
  return { service, jobs: emailQueue.jobs(), logs, metrics, memory: users, sessions, emailTokens };
}

describe("auth service", () => {
  it("creates an account with consent and a stored hash", async () => {
    const { service, memory } = createHarness();

    const response = await service.register(validRegistration, { ip: IP });

    expect(response).toEqual({ status: "accepted", message: AUTH_COPY.registerAccepted });
    const [user] = memory.records();
    expect(user?.email).toBe("learner@example.com");
    expect(user?.passwordHash).toBe("hashed:correct-horse-battery");
    expect(user?.passwordHash).not.toBe(validRegistration.password);
    expect(user?.consents).toEqual([
      {
        policy: "terms",
        version: "2026-10-03",
        acceptedAt: NOW,
        ipHash: hashIp(IP, SECRET),
      },
      {
        policy: "privacy",
        version: "2026-10-03",
        acceptedAt: NOW,
        ipHash: hashIp(IP, SECRET),
      },
    ]);
    expect(user?.consents[0]?.ipHash).not.toBe(IP);
  });

  it("returns the same response for an existing email and queues a notice", async () => {
    const { service, memory, jobs } = createHarness();

    const first = await service.register(validRegistration, { ip: IP });
    const second = await service.register(
      { ...validRegistration, displayName: "Someone else" },
      { ip: IP },
    );

    expect(second).toEqual(first);
    expect(memory.records()).toHaveLength(1);
    expect(memory.records()[0]?.displayName).toBe("Ada");
    expect(jobs.map((job) => job.template)).toEqual(["verify-email", "registration-notice"]);
    expect(jobs[1]?.to).toBe("learner@example.com");
    expect(JSON.stringify(jobs)).not.toContain(validRegistration.password);
  });

  it("rejects a common password without creating a user", async () => {
    const { service, memory } = createHarness();

    await expect(
      service.register({ ...validRegistration, password: "Password123" }, { ip: IP }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(memory.records()).toHaveLength(0);
  });

  it("does not log the password or hash", async () => {
    const { service, logs } = createHarness();
    await service.register(validRegistration, { ip: IP });
    await expect(
      service.login({ email: validRegistration.email, password: "wrong-password" }, { ip: IP }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    const serialized = logs.join("\n");
    expect(serialized).not.toContain(validRegistration.password);
    expect(serialized).not.toContain("hashed:");
    expect(serialized).not.toContain("wrong-password");
  });

  it("returns a generic error for unknown emails and wrong passwords", async () => {
    const { service } = createHarness();
    await service.register(validRegistration, { ip: IP });

    const missing = service.login(
      { email: "missing@example.com", password: validRegistration.password },
      { ip: IP },
    );
    const wrong = service.login(
      { email: validRegistration.email, password: "not-the-password" },
      { ip: IP },
    );

    await expect(missing).rejects.toMatchObject({
      status: 401,
      detail: AUTH_COPY.invalidCredentials,
    });
    await expect(wrong).rejects.toMatchObject({
      status: 401,
      detail: AUTH_COPY.invalidCredentials,
    });
  });

  it("blocks the sixth failed login for an email and IP pair", async () => {
    const { service } = createHarness();
    await service.register(validRegistration, { ip: IP });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({ email: validRegistration.email, password: "not-the-password" }, { ip: IP }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    }

    const blocked = service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP },
    );
    await expect(blocked).rejects.toBeInstanceOf(RateLimitedError);
    await expect(blocked).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("clears the failure counter after a successful login", async () => {
    const { service } = createHarness();
    await service.register(validRegistration, { ip: IP });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        service.login({ email: validRegistration.email, password: "not-the-password" }, { ip: IP }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    }

    await expect(
      service.login(
        { email: validRegistration.email, password: validRegistration.password },
        { ip: IP },
      ),
    ).resolves.toMatchObject({ status: "authenticated", user: { displayName: "Ada" } });

    await expect(
      service.login({ email: validRegistration.email, password: "not-the-password" }, { ip: IP }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("treats a soft-deleted account as unavailable without creating another", async () => {
    const { service, memory, jobs } = createHarness();
    await service.register(validRegistration, { ip: IP });
    expect(jobs).toHaveLength(1);
    memory.markDeleted("learner@example.com");

    const response = await service.register(validRegistration, { ip: IP });
    expect(response.status).toBe("accepted");
    expect(memory.records()).toHaveLength(1);
    expect(jobs).toHaveLength(1);

    await expect(
      service.login(
        { email: validRegistration.email, password: validRegistration.password },
        { ip: IP },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rotates a refresh token and revokes the family when the old token is reused", async () => {
    let now = new Date();
    const { service, logs, metrics, sessions } = createHarness({ clock: () => now });
    await service.register(validRegistration, { ip: IP });
    const login = await service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP, userAgent: "DeviceA" },
    );

    now = new Date(now.getTime() + 1000);
    const rotated = await service.refresh(login.credentials.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.credentials.refreshToken);
    expect(rotated.accessToken).not.toBe(login.credentials.accessToken);

    const claims = await tokenService.verifyAccessToken(rotated.accessToken);
    expect(claims.sub).toBe(login.user.id);
    expect(claims.role).toBe("learner");
    expect(claims.sid).toBeTruthy();
    expect(logs.join("\n")).not.toContain(login.credentials.refreshToken);
    expect(logs.join("\n")).not.toContain(rotated.refreshToken);

    await expect(service.refresh(login.credentials.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(service.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);

    expect(metrics.renderPrometheus()).toContain('auth_refresh_total{result="reuse"} 1');
    expect(metrics.renderPrometheus()).toContain("auth_token_reuse_detected_total 1");
    expect(sessions.records().every((row) => row.revokedReason === "reuse" || row.revokedAt)).toBe(
      true,
    );
    expect(sessions.records().every((row) => row.revokedAt !== null)).toBe(true);
  });

  it("lists active sessions and revokes one device without affecting the other", async () => {
    const { service } = createHarness({ clock: () => new Date() });
    await service.register(validRegistration, { ip: IP });
    const deviceA = await service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP, userAgent: "DeviceA" },
    );
    const deviceB = await service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP, userAgent: "DeviceB" },
    );

    const claimsA = await tokenService.verifyAccessToken(deviceA.credentials.accessToken);
    const claimsB = await tokenService.verifyAccessToken(deviceB.credentials.accessToken);
    const listed = await service.listSessions(claimsA.sub, claimsA.sid);
    expect(listed.sessions).toHaveLength(2);
    expect(listed.sessions.find((session) => session.id === claimsA.sid)?.current).toBe(true);
    expect(listed.sessions.find((session) => session.id === claimsB.sid)?.current).toBe(false);

    await service.revokeSession(claimsA.sub, claimsB.sid);
    await expect(service.refresh(deviceB.credentials.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(service.refresh(deviceA.credentials.refreshToken)).resolves.toMatchObject({
      accessMaxAgeSeconds: 900,
    });
    await expect(service.revokeSession(claimsA.sub, "missing-session")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("stores only a hash of the verification token and rejects a second use", async () => {
    const { service, jobs, memory, emailTokens } = createHarness();
    await service.register(validRegistration, { ip: IP, locale: "de" });

    const job = jobs[0];
    expect(job?.template).toBe("verify-email");
    expect(job?.locale).toBe("de");
    const token = new URL(job?.url ?? "").searchParams.get("token");
    expect(token).toBeTruthy();
    expect(Buffer.from(token ?? "", "base64url")).toHaveLength(32);
    expect(emailTokens.records()[0]?.tokenHash).not.toBe(token);
    expect(JSON.stringify(emailTokens.records())).not.toContain(token);

    await expect(service.verifyEmail(token ?? "")).resolves.toEqual({
      status: "verified",
      message: AUTH_COPY.emailVerified,
    });
    expect(memory.records()[0]?.emailVerifiedAt).toEqual(NOW);
    await expect(service.verifyEmail(token ?? "")).rejects.toMatchObject({
      status: 409,
      detail: AUTH_COPY.linkAlreadyUsed,
    });
    await expect(service.verifyEmail(token ?? "")).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an expired verification token", async () => {
    let now = NOW;
    const { service, jobs } = createHarness({ clock: () => now });
    await service.register(validRegistration, { ip: IP });
    const token = new URL(jobs[0]?.url ?? "").searchParams.get("token") ?? "";
    now = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    await expect(service.verifyEmail(token)).rejects.toMatchObject({
      detail: AUTH_COPY.linkExpired,
    });
  });

  it("answers password reset the same way when the email is unknown and when it is rate limited", async () => {
    const { service, jobs } = createHarness();
    await service.register(validRegistration, { ip: IP });
    const known = { email: validRegistration.email };

    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(await service.forgotPassword(known, { ip: IP }));
    }
    const unknown = await service.forgotPassword({ email: "missing@example.com" }, { ip: IP });

    expect(
      responses.every((response) => JSON.stringify(response) === JSON.stringify(responses[0])),
    ).toBe(true);
    expect(unknown).toEqual(responses[0]);
    expect(unknown.message).toBe(AUTH_COPY.passwordResetAccepted);
    expect(jobs.filter((job) => job.template === "reset-password")).toHaveLength(3);
  });

  it("resets the password and revokes every session", async () => {
    const { service, jobs, sessions } = createHarness({ clock: () => new Date() });
    await service.register(validRegistration, { ip: IP });
    const deviceA = await service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP, userAgent: "DeviceA" },
    );
    const deviceB = await service.login(
      { email: validRegistration.email, password: validRegistration.password },
      { ip: IP, userAgent: "DeviceB" },
    );
    await service.forgotPassword({ email: validRegistration.email }, { ip: IP });
    const token =
      new URL(jobs.find((job) => job.template === "reset-password")?.url ?? "").searchParams.get(
        "token",
      ) ?? "";

    await expect(service.resetPassword({ token, password: "password123" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      service.resetPassword({ token, password: "a-new-strong-passphrase" }),
    ).resolves.toMatchObject({ status: "reset" });

    await expect(service.refresh(deviceA.credentials.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(service.refresh(deviceB.credentials.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(sessions.records().every((row) => row.revokedReason === "password_reset")).toBe(true);
    await expect(
      service.login(
        { email: validRegistration.email, password: "a-new-strong-passphrase" },
        { ip: IP },
      ),
    ).resolves.toMatchObject({ status: "authenticated" });
    await expect(
      service.login(
        { email: validRegistration.email, password: validRegistration.password },
        { ip: IP },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
