import { EMAIL_JOB_ATTEMPTS, EMAIL_JOB_BACKOFF_MS } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { EMAIL_QUEUE_JOB_OPTIONS } from "./email-queue.js";

describe("email queue options", () => {
  it("retries failed sends five times with exponential backoff", () => {
    expect(EMAIL_JOB_ATTEMPTS).toBe(5);
    expect(EMAIL_QUEUE_JOB_OPTIONS).toEqual({
      attempts: 5,
      backoff: { type: "exponential", delay: EMAIL_JOB_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  });
});
