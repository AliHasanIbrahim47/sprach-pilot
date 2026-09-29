import { z } from "zod";

export const ERROR_TYPE_BASE = "https://sprachpilot.app/errors";

export const fieldErrorSchema = z
  .object({
    field: z.string().max(200),
    code: z.string().max(100),
    message: z.string().max(500),
  })
  .meta({ id: "FieldError" });

export type FieldError = z.infer<typeof fieldErrorSchema>;

/**
 * RFC 9457 Problem Details shape (SP-009). Validation responses use this now;
 * the full error middleware lands in SP-009.
 */
export const problemDetailsSchema = z
  .object({
    type: z.string().url().max(500),
    title: z.string().max(200),
    status: z.number().int(),
    detail: z.string().max(2_000).optional(),
    instance: z.string().max(500).optional(),
    requestId: z.string().max(100).optional(),
    errors: z.array(fieldErrorSchema).max(100).optional(),
  })
  .meta({ id: "ProblemDetails" });

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export function validationProblem(input: {
  instance: string;
  requestId?: string;
  errors: FieldError[];
}): ProblemDetails {
  const problem: ProblemDetails = {
    type: `${ERROR_TYPE_BASE}/validation`,
    title: "Validation failed",
    status: 400,
    detail: "One or more fields are invalid",
    instance: input.instance,
    errors: input.errors,
  };

  if (input.requestId !== undefined) {
    problem.requestId = input.requestId;
  }

  return problem;
}
