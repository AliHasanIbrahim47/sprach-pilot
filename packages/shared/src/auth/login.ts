import { z } from "zod";

/** Login body. Length policy is enforced at registration, not here, so a wrong short password still gets the generic error. */
export const loginBodySchema = z
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
      .min(1)
      .max(128)
      .meta({ description: "Account password", example: "ChangeMe!Learner1" }),
  })
  .meta({ id: "LoginBody" });

export type LoginBody = z.infer<typeof loginBodySchema>;

export const loginSuccessResponseSchema = z
  .object({
    status: z.literal("authenticated"),
    user: z
      .object({
        id: z.string().min(1).max(64),
        displayName: z.string().min(1).max(100),
      })
      .meta({ id: "LoginUser" }),
  })
  .meta({ id: "LoginSuccessResponse" });

export type LoginSuccessResponse = z.infer<typeof loginSuccessResponseSchema>;
