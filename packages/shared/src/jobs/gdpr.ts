import { z } from "zod";

import { UI_LOCALES } from "../locale.js";

export const GDPR_QUEUE_NAME = "gdpr";

export const GDPR_EXPORT_JOB_NAME = "export";

export const GDPR_PURGE_JOB_NAME = "purge";

export const GDPR_JOB_ATTEMPTS = 5;

export const GDPR_JOB_BACKOFF_MS = 1_000;

export const gdprExportJobSchema = z.object({
  exportId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  locale: z.enum(UI_LOCALES),
});

export const gdprPurgeJobSchema = z.object({
  userId: z.string().min(1),
});

export type GdprExportJob = z.infer<typeof gdprExportJobSchema>;

export type GdprPurgeJob = z.infer<typeof gdprPurgeJobSchema>;
