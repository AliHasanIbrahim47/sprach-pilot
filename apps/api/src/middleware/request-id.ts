import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  res.locals["requestId"] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function readRequestId(_req: Request, res: Response): string | undefined {
  const fromLocals = res.locals?.["requestId"];
  if (typeof fromLocals === "string" && fromLocals.length > 0) {
    return fromLocals;
  }

  const header = res.getHeader(REQUEST_ID_HEADER);
  return typeof header === "string" ? header : undefined;
}
