import { createHash } from "node:crypto";

import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export type RateLimitRule = {
  /** Part of the stored key; must be unique per rule. */
  name: string;
  /** Allowed hits per window. The next one is refused. */
  limit: number;
  windowMs: number;
};

/**
 * Limits for the unauthenticated entry points. Per-IP limits slow down one
 * attacker; per-email limits stop many IPs from guessing one account's password.
 * Password reset codes also have per-account limits (src/server/auth/password-reset.ts).
 */
export const RATE_LIMITS = {
  loginPerIp: { name: "login-ip", limit: 20, windowMs: 15 * MINUTE_MS },
  loginPerEmail: { name: "login-email", limit: 10, windowMs: 15 * MINUTE_MS },
  registerPerIp: { name: "register-ip", limit: 5, windowMs: HOUR_MS },
  resetRequestPerIp: { name: "reset-request-ip", limit: 10, windowMs: HOUR_MS },
  resetVerifyPerIp: { name: "reset-verify-ip", limit: 30, windowMs: HOUR_MS },
} as const satisfies Record<string, RateLimitRule>;

export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      "RATE_LIMITED",
      429,
      `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfterSeconds / 60)} phút.`,
    );
  }
}

/** Rule name plus a hash of the subject, so IPs and emails are not stored as such. */
function keyFor(rule: RateLimitRule, subject: string): string {
  const digest = createHash("sha256").update(subject.trim().toLowerCase()).digest("hex");
  return `${rule.name}:${digest}`;
}

/**
 * Counts one hit for `subject` (an IP or an email) and throws RateLimitedError
 * once the rule's limit is passed. One atomic statement, so parallel requests
 * cannot slip past the limit. Refused hits still count: hammering keeps the
 * window full but does not extend it.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
): Promise<void> {
  const key = keyFor(rule, subject);
  const windowExpired = new Date(now.getTime() - rule.windowMs);
  const [row] = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowExpired} THEN 1
                     ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowExpired} THEN ${now}
                           ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;
  if (row.count > rule.limit) {
    const retryAfterMs = row.windowStart.getTime() + rule.windowMs - now.getTime();
    throw new RateLimitedError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }
}

const LONGEST_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((rule) => rule.windowMs));

/** Removes counters whose window ended; called by the daily cron. Returns how many. */
export async function deleteExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - LONGEST_WINDOW_MS) } },
  });
  return count;
}

/**
 * The client's IP from the first `x-forwarded-for` entry. Vercel sets this
 * header itself and drops a client-sent value, so it cannot be spoofed there;
 * behind another proxy, that proxy must do the same.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
