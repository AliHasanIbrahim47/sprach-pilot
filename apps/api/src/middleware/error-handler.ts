import {
  ERROR_TYPE_BASE,
  isAppError,
  type ProblemDetails,
  RateLimitedError,
  toProblemDetails,
} from "@sprachpilot/shared";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";

import type { AppLogger } from "../infrastructure/logger.js";
import { mapPrismaError } from "../infrastructure/prisma-errors.js";
import { readRequestId } from "./request-id.js";

export type ErrorHandlerOptions = {
  nodeEnv: string;
  logger?: AppLogger;
};

function sendProblem(res: Response, problem: ProblemDetails): void {
  res.status(problem.status).type("application/problem+json").json(problem);
}

/**
 * Central RFC 9457 error middleware (SP-009).
 * Maps domain errors and Prisma P2002/P2025; unknown errors become generic 500s in production.
 */
export function createErrorHandler(options: ErrorHandlerOptions): ErrorRequestHandler {
  const logger = options.logger;
  const isProduction = options.nodeEnv === "production";

  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = readRequestId(req, res);
    const context = {
      instance: req.originalUrl,
      ...(requestId !== undefined ? { requestId } : {}),
    };

    const domainError = isAppError(error) ? error : mapPrismaError(error);

    if (domainError) {
      if (domainError instanceof RateLimitedError && domainError.retryAfterSeconds !== undefined) {
        res.setHeader("Retry-After", String(domainError.retryAfterSeconds));
      }

      const problem = domainError.toProblemDetails(context);
      const logMeta = {
        requestId,
        code: domainError.code,
        status: domainError.status,
        detail: domainError.detail,
      };

      if (domainError.status >= 500) {
        logger?.error(domainError.message, {
          ...logMeta,
          stack: domainError.stack,
        });
      } else {
        logger?.info(domainError.message, logMeta);
      }

      sendProblem(res, problem);
      return;
    }

    const stack = error instanceof Error ? error.stack : undefined;
    const message = error instanceof Error ? error.message : "Unknown error";

    logger?.error(message, { requestId, stack });

    const problem = toProblemDetails(
      {
        type: `${ERROR_TYPE_BASE}/internal`,
        title: "Internal Server Error",
        status: 500,
        detail: isProduction ? "An unexpected error occurred" : message,
        exposeDetail: true,
      },
      context,
    );

    sendProblem(res, problem);
  };
}
