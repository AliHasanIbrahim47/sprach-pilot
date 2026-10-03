import { isIP } from "node:net";

import type { Request } from "express";

import { secretsEqual } from "./ip-hash.js";

/**
 * Prefer the socket address. A forwarded IP is accepted only when the web app
 * presents the shared internal secret, so clients cannot spoof the lockout key.
 */
export function resolveClientIp(req: Request, internalSecret: string | undefined): string {
  const providedSecret = req.header("x-sprachpilot-internal");
  const forwarded = req.header("x-sprachpilot-client-ip")?.trim();

  if (
    internalSecret !== undefined &&
    providedSecret !== undefined &&
    forwarded !== undefined &&
    secretsEqual(providedSecret, internalSecret) &&
    isIP(forwarded) !== 0
  ) {
    return forwarded;
  }

  const socketIp = req.ip || req.socket.remoteAddress;
  if (socketIp && socketIp.length > 0) return socketIp;
  return "0.0.0.0";
}
