import { UnrecoverableError } from "bullmq";
import { describe, expect, it } from "vitest";

import type { OutboundMail } from "./mailer.js";
import { createEmailProcessor } from "./process-email-job.js";

describe("email processor", () => {
  it("sends the rendered html and plain text", async () => {
    const sent: OutboundMail[] = [];
    const processJob = createEmailProcessor({
      async send(message) {
        sent.push(message);
      },
    });

    await processJob({
      data: {
        to: "learner@example.com",
        locale: "en",
        template: "verify-email",
        url: "http://localhost:3000/en/verify-email?token=abc",
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe("Verify your SprachPilot email");
    expect(sent[0]?.text).toContain("token=abc");
    expect(sent[0]?.html).toContain("token=abc");
  });

  it("does not retry an invalid payload", async () => {
    const processJob = createEmailProcessor({
      async send() {
        throw new Error("should not send");
      },
    });

    await expect(processJob({ data: { template: "verify-email" } })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("rethrows SMTP failures so the queue can retry", async () => {
    const processJob = createEmailProcessor({
      async send() {
        throw new Error("smtp down");
      },
    });

    await expect(
      processJob({
        data: {
          to: "learner@example.com",
          locale: "en",
          template: "registration-notice",
        },
      }),
    ).rejects.toThrow("smtp down");
  });
});
