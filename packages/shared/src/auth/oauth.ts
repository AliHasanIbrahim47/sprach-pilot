import { z } from "zod";

export const GOOGLE_OAUTH_PROVIDER = "google" as const;

export const oauthGoogleCallbackBodySchema = z
  .object({
    code: z.string().min(1).max(2048),
    state: z.string().min(1).max(512),
  })
  .meta({ id: "OAuthGoogleCallbackBody" });

export type OAuthGoogleCallbackBody = z.infer<typeof oauthGoogleCallbackBodySchema>;

export const oauthGoogleLinkBodySchema = z
  .object({
    linkToken: z.string().min(32).max(256),
    password: z.string().min(1).max(128),
  })
  .meta({ id: "OAuthGoogleLinkBody" });

export type OAuthGoogleLinkBody = z.infer<typeof oauthGoogleLinkBodySchema>;

export const oauthAuthenticatedResponseSchema = z
  .object({
    status: z.literal("authenticated"),
    needsOnboarding: z.boolean(),
    locale: z.string().min(2).max(8),
    user: z.object({
      id: z.string().min(1).max(64),
      displayName: z.string().min(1).max(100),
      emailVerified: z.boolean(),
    }),
  })
  .meta({ id: "OAuthAuthenticatedResponse" });

export type OAuthAuthenticatedResponse = z.infer<typeof oauthAuthenticatedResponseSchema>;

export const oauthLinkRequiredResponseSchema = z
  .object({
    status: z.literal("link_required"),
    linkToken: z.string().min(32).max(256),
    email: z.string().email().max(320),
    locale: z.string().min(2).max(8),
  })
  .meta({ id: "OAuthLinkRequiredResponse" });

export type OAuthLinkRequiredResponse = z.infer<typeof oauthLinkRequiredResponseSchema>;

export const oauthCallbackResponseSchema = z
  .discriminatedUnion("status", [oauthAuthenticatedResponseSchema, oauthLinkRequiredResponseSchema])
  .meta({ id: "OAuthCallbackResponse" });

export type OAuthCallbackResponse = z.infer<typeof oauthCallbackResponseSchema>;
