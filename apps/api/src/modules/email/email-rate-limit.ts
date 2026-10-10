import { createHmac } from "node:crypto";

/** Max verification or reset emails for one address inside the window. */
export const EMAIL_SEND_LIMIT = 3;

export const EMAIL_SEND_WINDOW_SECONDS = 60 * 60;

export type EmailSendPurpose = "verification" | "password_reset" | "registration_notice";

export interface EmailSendLimiter {
  /**
   * True when another email of this purpose may be sent.
   * A false result still consumes nothing visible to the caller: the HTTP
   * response stays the same and no message is queued.
   */
  consume(email: string, purpose: EmailSendPurpose): Promise<boolean>;
}

export interface EmailRateRedis {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * In-memory hourly cap used by tests. Each purpose has its own counter so a
 * verification email does not consume the password-reset budget.
 */
export function createMemoryEmailSendLimiter(options?: {
  now?: () => number;
  windowMs?: number;
  limit?: number;
}): EmailSendLimiter {
  const now = options?.now ?? Date.now;
  const windowMs = options?.windowMs ?? EMAIL_SEND_WINDOW_SECONDS * 1000;
  const limit = options?.limit ?? EMAIL_SEND_LIMIT;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    async consume(email, purpose) {
      const key = `${purpose}:${email}`;
      const current = buckets.get(key);
      if (!current || current.resetAt <= now()) {
        buckets.set(key, { count: 1, resetAt: now() + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}

/**
 * Redis hourly cap. The key is an HMAC of the address so Redis does not store
 * the raw email.
 */
export function createRedisEmailSendLimiter(
  redis: EmailRateRedis,
  options: { pepper: string; windowSeconds?: number; limit?: number },
): EmailSendLimiter {
  const windowSeconds = options.windowSeconds ?? EMAIL_SEND_WINDOW_SECONDS;
  const limit = options.limit ?? EMAIL_SEND_LIMIT;

  function keyFor(email: string, purpose: EmailSendPurpose): string {
    const digest = createHmac("sha256", options.pepper).update(`${purpose}:${email}`).digest("hex");
    return `auth:email-send:${digest}`;
  }

  return {
    async consume(email, purpose) {
      const key = keyFor(email, purpose);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      } else {
        const remaining = await redis.ttl(key);
        if (remaining < 0) await redis.expire(key, windowSeconds);
      }
      return count <= limit;
    },
  };
}
