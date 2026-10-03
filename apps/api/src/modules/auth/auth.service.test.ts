import {
  AUTH_COPY,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { createMemoryUserRepository } from "./auth.repository.js";
import {
  type AuthLogger,
  type AuthServiceDependencies,
  createAuthService,
} from "./auth.service.js";
import { hashIp } from "./ip-hash.js";
import { createMemoryLoginThrottle } from "./login-throttle.js";
import type { OutboundMail } from "./mailer.js";
import { createAuthMetrics } from "./metrics.js";
import type { PasswordHasher } from "./password-hasher.js";

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
  const sent: OutboundMail[] = [];
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
  const dependencies: AuthServiceDependencies = {
    users,
    throttle: createMemoryLoginThrottle(),
    mailer: {
      async send(message) {
        sent.push(message);
      },
    },
    metrics,
    hasher: createFakeHasher(),
    clock: () => NOW,
    ipHashSecret: SECRET,
    registrationEnabled: true,
    logger,
    ...overrides,
  };
  const service = createAuthService(dependencies);
  return { service, sent, logs, metrics, memory: users };
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

  it("returns the same response for an existing email and sends a notice", async () => {
    const { service, memory, sent } = createHarness();

    const first = await service.register(validRegistration, { ip: IP });
    const second = await service.register(
      { ...validRegistration, displayName: "Someone else" },
      { ip: IP },
    );

    expect(second).toEqual(first);
    expect(memory.records()).toHaveLength(1);
    expect(memory.records()[0]?.displayName).toBe("Ada");
    expect(sent).toEqual([
      expect.objectContaining({
        to: "learner@example.com",
        subject: expect.stringContaining("register"),
      }),
    ]);
    expect(JSON.stringify(sent)).not.toContain(validRegistration.password);
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
    const { service, memory, sent } = createHarness();
    await service.register(validRegistration, { ip: IP });
    memory.markDeleted("learner@example.com");

    const response = await service.register(validRegistration, { ip: IP });
    expect(response.status).toBe("accepted");
    expect(memory.records()).toHaveLength(1);
    expect(sent).toHaveLength(0);

    await expect(
      service.login(
        { email: validRegistration.email, password: validRegistration.password },
        { ip: IP },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
