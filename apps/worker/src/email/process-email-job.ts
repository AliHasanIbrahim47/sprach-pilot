import { emailJobSchema, type NotificationCategory } from "@sprachpilot/shared";
import { UnrecoverableError } from "bullmq";

import type { Mailer } from "./mailer.js";
import { renderEmail } from "./render-email.js";

export interface EmailProcessorOptions {
  /** When false, a non-critical notice is dropped instead of sent. */
  allowsNotification?: (input: {
    userId: string;
    category: NotificationCategory;
  }) => Promise<boolean>;
}

/**
 * Renders a localized message and hands it to SMTP.
 * A thrown error asks BullMQ to retry with the queue's exponential backoff.
 * Invalid payloads are not retried, and the error text never includes the link.
 * Jobs tagged as a notification are held when quiet hours or the preference say so.
 */
export function createEmailProcessor(mailer: Mailer, options: EmailProcessorOptions = {}) {
  return async (job: { data: unknown }): Promise<void> => {
    const parsed = emailJobSchema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError("invalid email job");
    if (parsed.data.notification) {
      const allowed = options.allowsNotification
        ? await options.allowsNotification(parsed.data.notification)
        : true;
      if (!allowed) return;
    }
    const rendered = await renderEmail(parsed.data);
    await mailer.send({
      to: parsed.data.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  };
}
