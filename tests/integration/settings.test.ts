import { beforeEach, describe, expect, it } from "vitest";

import { upsertBudget } from "@/server/budgets/service";
import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import {
  getBudgetAlerts,
  getPreferences,
  updateDisplayPreferences,
  updateNotificationPreferences,
  updateTheme,
} from "@/server/settings/service";
import { getPeriodStats } from "@/server/stats/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;

async function fields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("preferences", () => {
  it("start with the defaults", async () => {
    await expect(getPreferences(alice.userId)).resolves.toEqual({
      amountFormat: "SYMBOL",
      dateFormat: "DMY",
      weekStart: "MONDAY",
      timeZone: "Asia/Ho_Chi_Minh",
      theme: "SYSTEM",
      notifyBudgetWarning: true,
      notifyBudgetOver: true,
    });
  });

  it("save the display settings of the user only", async () => {
    await updateDisplayPreferences(alice.userId, {
      amountFormat: "DONG",
      dateFormat: "ISO",
      weekStart: "SUNDAY",
      timeZone: "Europe/London",
    });
    await expect(getPreferences(alice.userId)).resolves.toMatchObject({
      amountFormat: "DONG",
      dateFormat: "ISO",
      weekStart: "SUNDAY",
      timeZone: "Europe/London",
    });
    await expect(getPreferences(bob.userId)).resolves.toMatchObject({ amountFormat: "SYMBOL" });
  });

  it("reject unknown values and time zones", async () => {
    const valid = {
      amountFormat: "SYMBOL",
      dateFormat: "DMY",
      weekStart: "MONDAY",
      timeZone: "Asia/Ho_Chi_Minh",
    };
    await expect(
      fields(updateDisplayPreferences(alice.userId, { ...valid, timeZone: "Mars/Olympus" })),
    ).resolves.toEqual(["timeZone"]);
    await expect(
      fields(updateDisplayPreferences(alice.userId, { ...valid, amountFormat: "USD" })),
    ).resolves.toEqual(["amountFormat"]);
    await expect(fields(updateTheme(alice.userId, "PINK"))).resolves.toEqual(["theme"]);
  });

  it("save the theme and the notification switches", async () => {
    await updateTheme(alice.userId, "DARK");
    await updateNotificationPreferences(alice.userId, {
      notifyBudgetWarning: false,
      notifyBudgetOver: true,
    });
    await expect(getPreferences(alice.userId)).resolves.toMatchObject({
      theme: "DARK",
      notifyBudgetWarning: false,
      notifyBudgetOver: true,
    });
  });
});

describe("week start", () => {
  it("decides where a week begins in the statistics", async () => {
    // Sunday 22/11/2026 at noon in Vietnam.
    await prisma.transaction.create({
      data: {
        userId: alice.userId,
        type: "EXPENSE",
        amount: 50_000,
        categoryId: alice.food,
        occurredAt: new Date("2026-11-22T05:00:00Z"),
      },
    });
    const monday = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-24" });
    expect(monday.start).toBe("2026-11-23");
    expect(monday.totals.expense).toBe(0);

    await prisma.user.update({ where: { id: alice.userId }, data: { weekStart: "SUNDAY" } });
    const sunday = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-24" });
    expect(sunday).toMatchObject({
      start: "2026-11-22",
      previous: "2026-11-15",
      next: "2026-11-29",
    });
    expect(sunday.buckets[0]).toEqual({ key: "2026-11-22", income: 0, expense: 50_000 });
  });
});

describe("getBudgetAlerts", () => {
  async function spend(user: UserFixture, amount: number) {
    await prisma.transaction.create({
      data: {
        userId: user.userId,
        type: "EXPENSE",
        amount,
        categoryId: user.food,
        occurredAt: new Date("2026-11-20T05:00:00Z"),
      },
    });
  }

  it("lists budgets at 80% or more, depending on the switches", async () => {
    const transport = (
      await prisma.category.findFirstOrThrow({ where: { userId: alice.userId, name: "Đi lại" } })
    ).id;
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 100_000 });
    await upsertBudget(alice.userId, { categoryId: transport, month: "2026-11", amount: 100_000 });
    await spend(alice, 120_000); // food: over
    await prisma.transaction.create({
      data: {
        userId: alice.userId,
        type: "EXPENSE",
        amount: 85_000,
        categoryId: transport,
        occurredAt: new Date("2026-11-20T05:00:00Z"),
      },
    }); // transport: warning

    const all = await getBudgetAlerts(alice.userId, "2026-11");
    expect(all.map((alert) => [alert.name, alert.status])).toEqual([
      ["Ăn uống", "over"],
      ["Đi lại", "warning"],
    ]);

    await updateNotificationPreferences(alice.userId, {
      notifyBudgetWarning: false,
      notifyBudgetOver: true,
    });
    expect((await getBudgetAlerts(alice.userId, "2026-11")).map((a) => a.status)).toEqual(["over"]);

    await updateNotificationPreferences(alice.userId, {
      notifyBudgetWarning: false,
      notifyBudgetOver: false,
    });
    await expect(getBudgetAlerts(alice.userId, "2026-11")).resolves.toEqual([]);
  });

  it("never includes another user's budgets", async () => {
    await upsertBudget(bob.userId, { categoryId: bob.food, month: "2026-11", amount: 1 });
    await spend(bob, 10);
    await expect(getBudgetAlerts(alice.userId, "2026-11")).resolves.toEqual([]);
  });
});
