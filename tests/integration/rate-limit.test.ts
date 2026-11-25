import { describe, expect, it } from "vitest";

import { POST as registerRoute } from "@/app/api/auth/register/route";
import { authenticate, registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";
import {
  clientIp,
  deleteExpiredRateLimits,
  enforceRateLimit,
  RATE_LIMITS,
  RateLimitedError,
  type RateLimitRule,
} from "@/server/rate-limit";

const NOW = new Date("2026-11-25T03:00:00Z");
const MINUTE = 60 * 1000;
const RULE: RateLimitRule = { name: "test", limit: 3, windowMs: 10 * MINUTE };

const later = (ms: number): Date => new Date(NOW.getTime() + ms);

async function hits(rule: RateLimitRule, subject: string, times: number, at = NOW) {
  for (let i = 0; i < times; i++) {
    await enforceRateLimit(rule, subject, at);
  }
}

describe("enforceRateLimit", () => {
  it("allows `limit` hits, then refuses with the time left in the window", async () => {
    await hits(RULE, "1.2.3.4", 3);

    const refused = enforceRateLimit(RULE, "1.2.3.4", later(4 * MINUTE));
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 6 * 60,
      message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau 6 phút.",
    });
  });

  it("starts a new window once the old one ends", async () => {
    await hits(RULE, "1.2.3.4", 3);
    await expect(enforceRateLimit(RULE, "1.2.3.4", later(9 * MINUTE))).rejects.toThrow(
      RateLimitedError,
    );
    await expect(hits(RULE, "1.2.3.4", 3, later(10 * MINUTE))).resolves.toBeUndefined();
  });

  it("counts each subject and each rule separately, case-insensitively", async () => {
    await hits(RULE, "An@Example.com", 3);
    await expect(enforceRateLimit(RULE, "an@example.com", NOW)).rejects.toThrow(RateLimitedError);
    await expect(enforceRateLimit(RULE, "binh@example.com", NOW)).resolves.toBeUndefined();
    await expect(
      enforceRateLimit({ ...RULE, name: "other" }, "an@example.com", NOW),
    ).resolves.toBeUndefined();
  });

  it("lets exactly `limit` of many parallel hits through", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => enforceRateLimit(RULE, "5.6.7.8", NOW)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });

  it("does not store the IP or email itself", async () => {
    await enforceRateLimit(RULE, "an@example.com", NOW);
    const [row] = await prisma.rateLimit.findMany();
    expect(row.key).toMatch(/^test:[0-9a-f]{64}$/);
  });
});

describe("deleteExpiredRateLimits", () => {
  it("removes counters older than the longest window only", async () => {
    await enforceRateLimit(RULE, "old", NOW);
    await enforceRateLimit(RULE, "recent", later(30 * MINUTE));

    await expect(deleteExpiredRateLimits(later(61 * MINUTE))).resolves.toBe(1);
    expect(await prisma.rateLimit.count()).toBe(1);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("authenticate", () => {
  const PASSWORD = "mat-khau-an-toan";
  const login = (ip: string, password = PASSWORD) =>
    authenticate({ email: "an@example.com", password }, ip, NOW);

  it("locks one account after 10 attempts from any mix of IPs, even with the right password", async () => {
    await registerUser({ email: "an@example.com", password: PASSWORD });
    for (let i = 0; i < RATE_LIMITS.loginPerEmail.limit; i++) {
      await expect(login(`10.0.0.${i}`, "sai-mat-khau")).resolves.toBeNull();
    }
    await expect(login("10.0.1.1")).rejects.toThrow(RateLimitedError);
    // Another account from the same IPs is unaffected.
    await registerUser({ email: "binh@example.com", password: PASSWORD });
    await expect(
      authenticate({ email: "binh@example.com", password: PASSWORD }, "10.0.0.1", NOW),
    ).resolves.toMatchObject({ email: "binh@example.com" });
  });

  it("limits one IP across many emails", async () => {
    for (let i = 0; i < RATE_LIMITS.loginPerIp.limit; i++) {
      await authenticate({ email: `user${i}@example.com`, password: "x" }, "198.51.100.1", NOW);
    }
    await expect(
      authenticate({ email: "last@example.com", password: "x" }, "198.51.100.1", NOW),
    ).rejects.toThrow(RateLimitedError);
  });
});

describe("POST /api/auth/register rate limit", () => {
  const register = (i: number, ip = "192.0.2.10") =>
    registerRoute(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: `u${i}@example.com`, password: "mat-khau-an-toan" }),
      }),
    );

  it("answers 429 with Retry-After past 5 sign-ups per IP per hour", async () => {
    for (let i = 0; i < RATE_LIMITS.registerPerIp.limit; i++) {
      expect((await register(i)).status).toBe(201);
    }
    const refused = await register(99);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: "RATE_LIMITED" });
    expect(await prisma.user.count()).toBe(RATE_LIMITS.registerPerIp.limit);

    expect((await register(100, "192.0.2.11")).status).toBe(201);
  });
});
