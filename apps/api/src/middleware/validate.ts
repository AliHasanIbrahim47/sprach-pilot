import { type FieldError, validationProblem } from "@sprachpilot/shared";
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { REQUEST_ID_HEADER } from "./request-id.js";

type RequestTarget = "body" | "query" | "params";

function zodIssuesToFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string; code: string }>,
): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join(".") : "_root",
    code: issue.code,
    message: issue.message,
  }));
}

function readTarget(req: Request, target: RequestTarget): unknown {
  switch (target) {
    case "body":
      return req.body;
    case "query":
      return req.query;
    case "params":
      return req.params;
  }
}

function writeTarget(req: Request, target: RequestTarget, value: unknown): void {
  switch (target) {
    case "body":
      req.body = value;
      return;
    case "query":
      req.query = value as Request["query"];
      return;
    case "params":
      req.params = value as Request["params"];
  }
}

function validateTarget(schema: ZodType, target: RequestTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(readTarget(req, target));

    if (!result.success) {
      const requestIdHeader = res.getHeader(REQUEST_ID_HEADER);
      const requestId = typeof requestIdHeader === "string" ? requestIdHeader : undefined;
      const problem = validationProblem({
        instance: req.originalUrl,
        errors: zodIssuesToFieldErrors(result.error.issues),
        ...(requestId !== undefined ? { requestId } : {}),
      });

      res.status(400).type("application/problem+json").json(problem);
      return;
    }

    // Replace with parsed/stripped data (unknown keys removed by Zod object default).
    writeTarget(req, target, result.data);
    next();
  };
}

export function validateBody(schema: ZodType) {
  return validateTarget(schema, "body");
}

export function validateQuery(schema: ZodType) {
  return validateTarget(schema, "query");
}

export function validateParams(schema: ZodType) {
  return validateTarget(schema, "params");
}
