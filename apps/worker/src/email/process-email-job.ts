import { emailJobSchema } from "@sprachpilot/shared";
import { UnrecoverableError } from "bullmq";

import type { Mailer } from "./mailer.js";
import { renderEmail } from "./render-email.js";

/**
 * Renders a localized message and hands it to SMTP.
 * A thrown error asks BullMQ to retry with the queue's exponential backoff.
 * Invalid payloads are not retried, and the error text never includes the link.
 */
export function createEmailProcessor(mailer: Mailer) {
  return async (job: { data: unknown }): Promise<void> => {
    const parsed = emailJobSchema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError("invalid email job");
    const rendered = await renderEmail(parsed.data);
    await mailer.send({
      to: parsed.data.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  };
}
