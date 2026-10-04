import { z } from "zod";

export const refreshSuccessResponseSchema = z
  .object({
    status: z.literal("refreshed"),
  })
  .meta({ id: "RefreshSuccessResponse" });

export type RefreshSuccessResponse = z.infer<typeof refreshSuccessResponseSchema>;

export const authSessionSchema = z
  .object({
    id: z.string().min(1).max(64).meta({
      description: "Stable session family id. Matches the access token sid.",
      example: "018f1c3a-7b2e-7c4a-8d11-6a0e5b9c4d22",
    }),
    current: z.boolean().meta({ description: "True for the session that presented this request" }),
    userAgent: z.string().nullable().meta({ description: "Device user agent captured at login" }),
    createdAt: z.string().datetime().meta({ description: "When the device session was opened" }),
    lastUsedAt: z
      .string()
      .datetime()
      .meta({ description: "When the refresh token was last rotated" }),
    expiresAt: z
      .string()
      .datetime()
      .meta({ description: "When the current refresh token expires" }),
  })
  .meta({ id: "AuthSession" });

export type AuthSession = z.infer<typeof authSessionSchema>;

export const sessionListResponseSchema = z
  .object({
    sessions: z.array(authSessionSchema),
  })
  .meta({ id: "SessionListResponse" });

export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
