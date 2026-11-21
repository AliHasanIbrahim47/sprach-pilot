import { randomUUID } from "node:crypto";

import type { UserRepository } from "./auth.repository.js";
import type { AuthRequestContext, IssuedCredentials } from "./auth.service.js";
import { hashIp } from "./ip-hash.js";
import type { SessionRepository } from "./session.repository.js";
import type { TokenService } from "./token.service.js";

export type SessionAdmissionClass = "blocked" | "grace" | "clear";

export type SessionAdmissionVerdict = "allowed" | "refused";

export type OpenSessionResult =
  { status: "opened"; credentials: IssuedCredentials } | { status: "refused" };

/** The account fields session admission needs. Callers already loaded the row. */
export interface SessionAdmissionAccount {
  id: string;
  role: string;
  deletedAt: Date | null;
  deletionRequestedAt: Date | null;
  purgeAfter: Date | null;
}

export interface SessionAdmission {
  classify(user: SessionAdmissionAccount | null): SessionAdmissionClass;
  open(user: SessionAdmissionAccount, context: AuthRequestContext): Promise<OpenSessionResult>;
  continue(user: SessionAdmissionAccount | null): SessionAdmissionVerdict;
}

export interface SessionAdmissionDependencies {
  users: Pick<UserRepository, "clearDeletion">;
  sessions: Pick<SessionRepository, "create">;
  tokens: Pick<
    TokenService,
    | "createRefreshToken"
    | "hashRefreshToken"
    | "signAccessToken"
    | "refreshTtlSeconds"
    | "accessTtlSeconds"
  >;
  clock: () => Date;
  ipHashSecret: string;
  /** Called when a fresh sign-in clears a grace-window deletion. */
  onDeletionCancelled?: (() => void) | undefined;
}

export function createSessionAdmission(
  dependencies: SessionAdmissionDependencies,
): SessionAdmission {
  const { users, sessions, tokens, clock, ipHashSecret, onDeletionCancelled } = dependencies;

  function classifyAt(user: SessionAdmissionAccount | null, now: Date): SessionAdmissionClass {
    if (!user || user.deletedAt !== null || purgeIsDue(user, now)) return "blocked";
    if (user.deletionRequestedAt) return "grace";
    return "clear";
  }

  return {
    classify(user) {
      return classifyAt(user, clock());
    },

    async open(user, context) {
      const now = clock();
      const kind = classifyAt(user, now);
      if (kind === "blocked") return { status: "refused" };
      if (kind === "grace") {
        const cancelled = await users.clearDeletion(user.id, now);
        if (!cancelled) return { status: "refused" };
        onDeletionCancelled?.();
      }

      const refreshToken = tokens.createRefreshToken();
      const familyId = randomUUID();
      const session = await sessions.create({
        userId: user.id,
        familyId,
        refreshTokenHash: tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(now.getTime() + tokens.refreshTtlSeconds * 1000),
        userAgent: deviceUserAgent(context.userAgent),
        ipHash: hashIp(context.ip, ipHashSecret),
        now,
      });
      const accessToken = await tokens.signAccessToken(
        { sub: user.id, role: user.role, sid: session.familyId },
        now,
      );
      return {
        status: "opened",
        credentials: {
          accessToken,
          refreshToken,
          accessMaxAgeSeconds: tokens.accessTtlSeconds,
          refreshMaxAgeSeconds: tokens.refreshTtlSeconds,
        },
      };
    },

    continue(user) {
      return classifyAt(user, clock()) === "clear" ? "allowed" : "refused";
    },
  };
}

function purgeIsDue(user: { purgeAfter: Date | null }, now: Date): boolean {
  return user.purgeAfter !== null && user.purgeAfter.getTime() <= now.getTime();
}

function deviceUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replaceAll("\u0000", "");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 256);
}
