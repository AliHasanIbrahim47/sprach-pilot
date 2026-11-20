import { z } from "zod";

import { OPTIONAL_CONSENT_POLICIES } from "./constants.js";

export const consentDecisionSchema = z.enum(["granted", "withdrawn"]).meta({
  id: "ConsentDecision",
});

export const privacyConsentSchema = z
  .object({
    policy: z.string(),
    version: z.string(),
    decision: consentDecisionSchema,
    recordedAt: z.string().datetime(),
  })
  .meta({ id: "PrivacyConsent" });

export const privacyOverviewSchema = z
  .object({
    consents: z.array(privacyConsentSchema),
    deletion: z
      .object({
        purgeAfter: z.string().datetime(),
      })
      .nullable(),
    export: z
      .object({
        id: z.string(),
        status: z.enum(["queued", "ready", "failed"]),
        downloadUrl: z.string().url().nullable(),
      })
      .nullable(),
  })
  .meta({ id: "PrivacyOverview" });

export const exportAcceptedSchema = z
  .object({
    id: z.string(),
    status: z.literal("queued"),
  })
  .meta({ id: "ExportAccepted" });

export const deletionAcceptedSchema = z
  .object({
    purgeAfter: z.string().datetime(),
  })
  .meta({ id: "DeletionAccepted" });

export const updateConsentBodySchema = z
  .object({
    policy: z.enum(OPTIONAL_CONSENT_POLICIES),
    granted: z.boolean(),
  })
  .meta({ id: "UpdateConsentBody" });

export type PrivacyOverview = z.infer<typeof privacyOverviewSchema>;
export type UpdateConsentBody = z.infer<typeof updateConsentBodySchema>;
export type PrivacyConsent = z.infer<typeof privacyConsentSchema>;
