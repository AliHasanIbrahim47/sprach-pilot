import { z } from "zod";

/** Registration body — full auth flow is SP-012; schema is shared for API + web now. */
export const registerBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(320)
      .meta({ description: "Normalized email address", example: "learner@example.com" }),
    password: z
      .string()
      .min(10)
      .max(128)
      .meta({ description: "Password (min 10 characters)", example: "ChangeMe!Learner1" }),
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .meta({ description: "Public display name", example: "Demo Learner" }),
    acceptedTerms: z.literal(true).meta({ description: "Must accept Terms and Privacy Policy" }),
  })
  .meta({ id: "RegisterBody" });

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const registerAcceptedResponseSchema = z
  .object({
    status: z.literal("accepted"),
    message: z.string().max(500),
  })
  .meta({ id: "RegisterAcceptedResponse" });

export type RegisterAcceptedResponse = z.infer<typeof registerAcceptedResponseSchema>;
