import { test as base } from "@playwright/test";

export * from "@playwright/test";

/** A random address in 198.18.0.0/15, the range reserved for benchmark tests. */
function fakeClientIp(): string {
  const byte = (): number => Math.floor(Math.random() * 256);
  return `198.${18 + Math.floor(Math.random() * 2)}.${byte()}.${byte()}`;
}

/**
 * Every test gets its own client IP through x-forwarded-for, the header the app
 * reads the IP from (Vercel sets it in production). Without this, all tests
 * would share one IP and trip the per-IP sign-up and sign-in limits.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": fakeClientIp() });
  },
});
