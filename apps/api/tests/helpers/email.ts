import { createMemoryEmailTokenRepository } from "../../src/modules/auth/email-token.repository.js";
import { createMemoryEmailQueue } from "../../src/modules/email/email-queue.js";
import { createMemoryEmailSendLimiter } from "../../src/modules/email/email-rate-limit.js";

/** In-process mail ports so route tests do not open Redis or SMTP. */
export function createTestEmailPorts() {
  const emailQueue = createMemoryEmailQueue();
  return {
    emailTokens: createMemoryEmailTokenRepository(),
    emailSends: createMemoryEmailSendLimiter(),
    emailQueue,
  };
}
