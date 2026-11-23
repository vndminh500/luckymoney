import { describe, expect, it } from "vitest";

import { findUserIdByAccount, resolveGoogleUser } from "@/server/auth/google";
import { registerUser } from "@/server/auth/users";
import { DEFAULT_CATEGORIES } from "@/server/categories/defaults";
import { prisma } from "@/server/db";

const profile = {
  sub: "google-sub-123",
  email: "An.Nguyen@Gmail.com",
  email_verified: true,
  name: "An Nguyễn",
};

describe("resolveGoogleUser", () => {
  it("creates a user, the Google account link and default categories on first sign-in", async () => {
    const result = await resolveGoogleUser(profile);

    expect(result).toEqual({ ok: true, userId: expect.any(String) });
    if (!result.ok) return;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { accounts: true },
    });
    expect(user).toMatchObject({
      email: "an.nguyen@gmail.com",
      name: "An Nguyễn",
      passwordHash: null,
    });
    expect(user.accounts).toEqual([
      expect.objectContaining({ provider: "google", providerAccountId: "google-sub-123" }),
    ]);
    // No OAuth tokens are stored: the app never calls Google APIs.
    expect(user.accounts[0]).toMatchObject({
      access_token: null,
      refresh_token: null,
      id_token: null,
    });
    expect(await prisma.category.count({ where: { userId: user.id } })).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it("returns the same user on later sign-ins, without duplicates", async () => {
    const first = await resolveGoogleUser(profile);
    const second = await resolveGoogleUser({ ...profile, name: "Tên mới" });

    expect(second).toEqual(first);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(1);
    expect(await prisma.category.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("finds the user by Google id even if the Google email changed", async () => {
    const first = await resolveGoogleUser(profile);
    const second = await resolveGoogleUser({ ...profile, email: "new-address@gmail.com" });
    expect(second).toEqual(first);
  });

  it("refuses to link to an existing password account with the same email", async () => {
    // Without email verification, a password account may have been created by
    // someone else; linking would let them read the Google user's data.
    await registerUser({ email: "an.nguyen@gmail.com", password: "mat-khau-an-toan" });

    await expect(resolveGoogleUser(profile)).resolves.toEqual({
      ok: false,
      reason: "ACCOUNT_NOT_LINKED",
    });
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });

  it("links to an existing account that has no password", async () => {
    const existing = await prisma.user.create({
      data: { email: "an.nguyen@gmail.com", passwordHash: null },
    });

    await expect(resolveGoogleUser(profile)).resolves.toEqual({ ok: true, userId: existing.id });
    expect(await prisma.account.count({ where: { userId: existing.id } })).toBe(1);
  });

  it.each([
    ["unverified email", { ...profile, email_verified: false }],
    ["missing email_verified", { sub: profile.sub, email: profile.email }],
    ["missing email", { sub: profile.sub, email_verified: true }],
    ["invalid email", { ...profile, email: "not-an-email" }],
    ["missing sub", { email: profile.email, email_verified: true }],
    ["no profile", undefined],
  ])("rejects %s", async (_case, input) => {
    await expect(resolveGoogleUser(input)).resolves.toEqual({
      ok: false,
      reason: "EMAIL_NOT_VERIFIED",
    });
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("findUserIdByAccount", () => {
  it("returns the linked user id, or null when there is no link", async () => {
    const result = await resolveGoogleUser(profile);
    if (!result.ok) throw new Error("expected sign-in to succeed");

    await expect(findUserIdByAccount("google", "google-sub-123")).resolves.toBe(result.userId);
    await expect(findUserIdByAccount("google", "someone-else")).resolves.toBeNull();
  });
});
