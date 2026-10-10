import { z } from "zod";

import { UI_LOCALES } from "../locale.js";

/** BullMQ queue reused by later worker jobs (SP-014). */
export const EMAIL_QUEUE_NAME = "email";

export const EMAIL_JOB_NAME = "send";

/** Failed SMTP sends retry with exponential backoff up to this many attempts. */
export const EMAIL_JOB_ATTEMPTS = 5;

export const EMAIL_JOB_BACKOFF_MS = 1_000;

export const emailTemplateSchema = z.enum([
  "verify-email",
  "reset-password",
  "registration-notice",
]);

export const emailJobSchema = z
  .object({
    to: z.string().email(),
    locale: z.enum(UI_LOCALES),
    template: emailTemplateSchema,
    url: z.string().url().optional(),
  })
  .refine((job) => job.template === "registration-notice" || job.url !== undefined, {
    path: ["url"],
    message: "Link emails require a url",
  });

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export type EmailJob = z.infer<typeof emailJobSchema>;
