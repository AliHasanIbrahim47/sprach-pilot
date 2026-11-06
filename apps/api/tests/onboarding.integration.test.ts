import { ACCESS_TOKEN_COOKIE } from "@sprachpilot/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { type AuthOverrides, createContainer } from "../src/container.js";
import { createMemoryAccountRepository } from "../src/modules/auth/account.repository.js";
import { createMemoryUserRepository } from "../src/modules/auth/auth.repository.js";
import { createMemoryLoginThrottle } from "../src/modules/auth/login-throttle.js";
import { createAuthMetrics } from "../src/modules/auth/metrics.js";
import type { PasswordHasher } from "../src/modules/auth/password-hasher.js";
import { createMemorySessionRepository } from "../src/modules/auth/session.repository.js";
import { createOnboardingMetrics } from "../src/modules/onboarding/metrics.js";
import { createMemoryOnboardingRepository } from "../src/modules/onboarding/onboarding.repository.js";
import { QUIZ_ITEMS } from "../src/modules/onboarding/quiz.js";
import { createTestEmailPorts } from "./helpers/email.js";
import { createValidApiEnv } from "./helpers/env.js";

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

function createOnboardingApp() {
  const users = createMemoryUserRepository();
  const email = createTestEmailPorts();
  const metrics = createOnboardingMetrics();
  const auth: AuthOverrides = {
    users,
    accounts: createMemoryAccountRepository(),
    sessions: createMemorySessionRepository(),
    throttle: createMemoryLoginThrottle(),
    metrics: createAuthMetrics(),
    hasher: createFakeHasher(),
    clock: () => new Date(),
    emailTokens: email.emailTokens,
    emailSends: email.emailSends,
    emailQueue: email.emailQueue,
  };
  const config = loadConfig(createValidApiEnv({ IP_HASH_SECRET: "integration-ip-hash-secret" }));
  const container = createContainer(config, {
    dependencyChecks: [
      { name: "database", check: async () => true },
      { name: "redis", check: async () => true },
    ],
    auth,
    onboarding: {
      profiles: createMemoryOnboardingRepository(),
      metrics,
      clock: () => new Date(),
    },
  });
  return { app: createApp(container), metrics };
}

async function registerAndLogin(app: ReturnType<typeof createApp>, email: string) {
  await request(app).post("/v1/auth/register").send({
    email,
    password: "correct-horse-battery",
    displayName: "Ada",
    acceptedTerms: true,
  });
  const login = await request(app).post("/v1/auth/login").send({
    email,
    password: "correct-horse-battery",
  });
  return cookieHeader(login, ACCESS_TOKEN_COOKIE);
}

/**
 * Reads one Set-Cookie value for the named cookie.
 */
function cookieHeader(response: request.Response, name: string): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const header = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  const value = header?.split(";")[0]?.slice(name.length + 1);
  if (!value) throw new Error(`missing ${name}`);
  return `${name}=${value}`;
}

/** Uses a correct choice for the first answers and a wrong choice for the rest. */
function choiceForScore(
  item: (typeof QUIZ_ITEMS)[number],
  index: number,
  correctCount: number,
): string {
  if (index < correctCount) return item.correctChoiceId;
  const wrong = item.choices.find((choice) => choice.id !== item.correctChoiceId);
  return wrong?.id ?? "b";
}

function answersWithScore(correctCount: number) {
  return {
    answers: QUIZ_ITEMS.map((item, index) => ({
      itemId: item.id,
      choiceId: choiceForScore(item, index, correctCount),
    })),
  };
}

describe("onboarding", () => {
  it("requires a session", async () => {
    const { app } = createOnboardingApp();
    const response = await request(app).get("/v1/onboarding");
    expect(response.status).toBe(401);
  });

  it("resumes on another read, suggests A2 for 7 of 10, and recommends housing after the city is skipped", async () => {
    const { app } = createOnboardingApp();
    const cookie = await registerAndLogin(app, "learner@example.com");

    const started = await request(app).get("/v1/onboarding").set("Cookie", cookie);
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ status: "pending", step: "languages", needsCity: true });

    const languages = await request(app)
      .patch("/v1/onboarding")
      .set("Cookie", cookie)
      .send({
        step: "languages",
        uiLocale: "de",
        nativeLanguages: ["en", "ar"],
      });
    expect(languages.status).toBe(200);
    expect(languages.body.step).toBe("level");

    const resumed = await request(app).get("/v1/onboarding").set("Cookie", cookie);
    expect(resumed.body).toMatchObject({
      step: "level",
      uiLocale: "de",
      nativeLanguages: ["en", "ar"],
    });

    const level = await request(app).patch("/v1/onboarding").set("Cookie", cookie).send({
      step: "level",
      cefrLevel: "A1",
    });
    expect(level.body.cefrLevel).toBe("A1");

    const quiz = await request(app).get("/v1/onboarding/quiz").set("Cookie", cookie);
    expect(quiz.body.items).toHaveLength(10);
    const listening = quiz.body.items.find(
      (item: { id: string }) => item.id === "a2-listening-hours",
    );
    expect(listening.transcript).toBe("Guten Tag, die Sprechstunde ist heute von 8 bis 12 Uhr.");
    expect(listening.correctChoiceId).toBeUndefined();

    const scored = await request(app)
      .post("/v1/onboarding/quiz")
      .set("Cookie", cookie)
      .send(answersWithScore(7));
    expect(scored.status).toBe(200);
    expect(scored.body).toEqual({ suggestedLevel: "A2", correctCount: 7, itemCount: 10 });

    const overridden = await request(app).patch("/v1/onboarding").set("Cookie", cookie).send({
      step: "quiz",
      skipped: false,
      cefrLevel: "B1",
    });
    expect(overridden.body.cefrLevel).toBe("B1");

    await request(app)
      .patch("/v1/onboarding")
      .set("Cookie", cookie)
      .send({
        step: "goals",
        goals: ["housing"],
      });

    const city = await request(app).get("/v1/cities").query({ q: "10115" }).set("Cookie", cookie);
    expect(city.body.cities[0]).toMatchObject({
      id: "de-berlin",
      latitude: 52.520008,
      longitude: 13.404954,
    });

    const stored = await request(app).patch("/v1/onboarding").set("Cookie", cookie).send({
      step: "city",
      skipped: false,
      cityId: "de-berlin",
    });
    expect(stored.body.city).toEqual({
      id: "de-berlin",
      name: "Berlin",
      latitude: 52.520008,
      longitude: 13.404954,
    });
    expect(stored.body.city.matchedPostalCode).toBeUndefined();

    const skippedCity = await request(app).patch("/v1/onboarding").set("Cookie", cookie).send({
      step: "city",
      skipped: true,
      cityId: null,
    });
    expect(skippedCity.body.city).toBeNull();
    expect(skippedCity.body.needsCity).toBe(true);

    const finished = await request(app).post("/v1/onboarding/complete").set("Cookie", cookie);
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe("completed");
    expect(finished.body.recommendations).toHaveLength(3);
    expect(
      finished.body.recommendations.some((scenario: { goals: string[] }) =>
        scenario.goals.includes("housing"),
      ),
    ).toBe(true);

    const rendered = await request(app).get("/metrics");
    expect(rendered.status).toBe(200);
    expect(rendered.text).toContain('onboarding_step_completed_total{step="languages"} 1');
    expect(rendered.text).toContain('onboarding_step_completed_total{step="quiz"} 1');
    expect(rendered.text).toContain('onboarding_step_completed_total{step="city"} 1');
  });

  it("stops showing the wizard after the learner skips it", async () => {
    const { app } = createOnboardingApp();
    const cookie = await registerAndLogin(app, "skip@example.com");

    const skipped = await request(app).post("/v1/onboarding/skip").set("Cookie", cookie);
    expect(skipped.status).toBe(200);
    expect(skipped.body.status).toBe("skipped");
    expect(skipped.body.needsCity).toBe(true);

    const again = await request(app).get("/v1/onboarding").set("Cookie", cookie);
    expect(again.body.status).toBe("skipped");
    const rendered = await request(app).get("/metrics");
    expect(rendered.text).toContain('onboarding_step_completed_total{step="skipped"} 1');
  });
});
