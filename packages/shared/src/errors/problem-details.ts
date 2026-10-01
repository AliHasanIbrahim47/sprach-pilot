import { z } from "zod";

import { ERROR_TYPE_BASE } from "./constants.js";

export { ERROR_TYPE_BASE };

export const fieldErrorSchema = z
  .object({
    field: z.string().max(200),
    code: z.string().max(100),
    message: z.string().max(500),
  })
  .meta({ id: "FieldError" });

export type FieldError = z.infer<typeof fieldErrorSchema>;

/** RFC 9457 Problem Details (SP-009). */
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

export type ProblemContext = {
  instance: string;
  requestId?: string;
};

export type ProblemSource = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: FieldError[];
  exposeDetail: boolean;
};

export function toProblemDetails(error: ProblemSource, context: ProblemContext): ProblemDetails {
  const problem: ProblemDetails = {
    type: error.type,
    title: error.title,
    status: error.status,
    instance: context.instance,
  };

  if (error.exposeDetail && error.detail !== undefined) {
    problem.detail = error.detail;
  }

  if (error.errors !== undefined && error.errors.length > 0) {
    problem.errors = error.errors;
  }

  if (context.requestId !== undefined) {
    problem.requestId = context.requestId;
  }

  return problem;
}

export function validationProblem(input: {
  instance: string;
  requestId?: string;
  errors: FieldError[];
}): ProblemDetails {
  return toProblemDetails(
    {
      type: `${ERROR_TYPE_BASE}/validation`,
      title: "Validation failed",
      status: 400,
      detail: "One or more fields are invalid",
      errors: input.errors,
      exposeDetail: true,
    },
    input,
  );
}
