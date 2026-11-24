import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy from "@/proxy";

const COOKIE_NAME = "authjs.session-token";

async function sessionCookie(maxAgeSeconds = 60 * 60): Promise<string> {
  const token = await encode({
    token: { sub: "user_1", email: "an@example.com" },
    secret: process.env.AUTH_SECRET ?? "",
    salt: COOKIE_NAME,
    maxAge: maxAgeSeconds,
  });
  return `${COOKIE_NAME}=${token}`;
}

async function run(path: string, cookie?: string): Promise<Response> {
  // Like Next.js, which sets x-forwarded-proto on every request.
  const headers: Record<string, string> = { "x-forwarded-proto": "http" };
  if (cookie) {
    headers.cookie = cookie;
  }
  const request = new NextRequest(`http://localhost${path}`, { headers });
  return proxy(request);
}

describe("proxy", () => {
  it("never sets cookies, so an in-flight request cannot undo sign-out", async () => {
    const response = await run("/transactions/new", await sessionCookie());

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("redirects guests from app pages to /login with callbackUrl", async () => {
    const response = await run("/transactions/new?x=1");

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/transactions/new?x=1");
  });

  it("treats an expired session cookie as signed out", async () => {
    const response = await run("/", await sessionCookie(-60));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("treats a tampered session cookie as signed out", async () => {
    const response = await run("/", `${await sessionCookie()}x`);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("returns 401 JSON for guests on protected APIs", async () => {
    const response = await run("/api/transactions");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
  });

  it("sends signed-in users away from /login", async () => {
    const response = await run("/login", await sessionCookie());
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
  });
});
