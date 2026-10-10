import { z } from "zod";

import { UI_LOCALES } from "../locale.js";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(320)
  .meta({ description: "Normalized email address", example: "learner@example.com" });

export const verifyEmailQuerySchema = z
  .object({
    token: z.string().min(32).max(256).meta({ description: "Single-use verification token" }),
  })
  .meta({ id: "VerifyEmailQuery" });

export type VerifyEmailQuery = z.infer<typeof verifyEmailQuerySchema>;

export const verifyEmailResponseSchema = z
  .object({
    status: z.literal("verified"),
    message: z.string().max(500),
  })
  .meta({ id: "VerifyEmailResponse" });

export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

export const resendVerificationBodySchema = z
  .object({
    email: emailSchema
      .optional()
      .meta({ description: "Account email. Ignored when a session cookie is present." }),
  })
  .meta({ id: "ResendVerificationBody" });

export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;

export const passwordForgotBodySchema = z
  .object({
    email: emailSchema,
  })
  .meta({ id: "PasswordForgotBody" });

export type PasswordForgotBody = z.infer<typeof passwordForgotBodySchema>;

export const passwordResetBodySchema = z
  .object({
    token: z.string().min(32).max(256).meta({ description: "Single-use reset token" }),
    password: z.string().min(10).max(128).meta({ description: "New password (min 10 characters)" }),
  })
  .meta({ id: "PasswordResetBody" });

export type PasswordResetBody = z.infer<typeof passwordResetBodySchema>;

export const passwordResetResponseSchema = z
  .object({
    status: z.literal("reset"),
    message: z.string().max(500),
  })
  .meta({ id: "PasswordResetResponse" });

export type PasswordResetResponse = z.infer<typeof passwordResetResponseSchema>;

export const accountResponseSchema = z
  .object({
    id: z.string().min(1).max(64),
    displayName: z.string().min(1).max(100),
    email: z.string().email().max(320),
    emailVerified: z.boolean(),
    locale: z.enum(UI_LOCALES),
  })
  .meta({ id: "AccountResponse" });

export type AccountResponse = z.infer<typeof accountResponseSchema>;
