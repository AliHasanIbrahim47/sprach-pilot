import { NotFoundError } from "@sprachpilot/shared";
import type { NextFunction, Request, Response } from "express";

/** Convert unmatched routes into a domain NotFoundError for the central handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
}
