import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { getPeriodStats } from "@/server/stats/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;

async function add(
  user: UserFixture,
  amount: number,
  at: string,
  type: "EXPENSE" | "INCOME" = "EXPENSE",
  deleted = false,
) {
  await prisma.transaction.create({
    data: {
      userId: user.userId,
      type,
      amount,
      categoryId: type === "EXPENSE" ? user.food : user.salary,
      occurredAt: new Date(at),
      deletedAt: deleted ? new Date() : null,
    },
  });
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
  // Asia/Ho_Chi_Minh (UTC+7). Week of Mon 23/11/2026: [11-22T17:00Z, 11-29T17:00Z).
  await add(alice, 1, "2026-11-22T16:59:59Z"); // Sun 22/11 local: previous week
  await add(alice, 10_000, "2026-11-22T17:00:00Z"); // Mon 23/11 00:00 local
  await add(alice, 20_000, "2026-11-25T05:00:00Z"); // Wed 25/11
  await add(alice, 5_000_000, "2026-11-27T02:00:00Z", "INCOME"); // Fri 27/11
  await add(alice, 30_000, "2026-11-29T16:59:59Z"); // Sun 29/11 23:59 local
  await add(alice, 2, "2026-11-29T17:00:00Z"); // Mon 30/11 local: next week
  await add(alice, 999_999, "2026-11-24T05:00:00Z", "EXPENSE", true); // deleted
  await add(alice, 40_000, "2026-03-10T05:00:00Z"); // March, same year
  await add(alice, 3, "2025-12-31T16:59:59Z"); // 31/12/2025 local: previous year
  await add(bob, 77_777, "2026-11-25T05:00:00Z"); // another user
});

describe("getPeriodStats: week", () => {
  it("has the seven days Monday to Sunday of the week containing the date", async () => {
    const stats = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-26" });

    expect(stats).toMatchObject({
      period: "week",
      start: "2026-11-23",
      previous: "2026-11-16",
      next: "2026-11-30",
      totals: { income: 5_000_000, expense: 60_000, balance: 4_940_000 },
    });
    expect(stats.buckets.map((bucket) => bucket.key)).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(stats.buckets[0]).toEqual({ key: "2026-11-23", income: 0, expense: 10_000 });
    expect(stats.buckets[4]).toEqual({ key: "2026-11-27", income: 5_000_000, expense: 0 });
    expect(stats.buckets[6]).toEqual({ key: "2026-11-29", income: 0, expense: 30_000 });
  });

  it("puts boundary transactions in the neighbouring weeks", async () => {
    const before = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-22" });
    const after = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-30" });
    expect(before.totals.expense).toBe(1);
    expect(after.totals.expense).toBe(2);
  });
});

describe("getPeriodStats: month", () => {
  it("has one bucket per day and totals of the local month", async () => {
    const stats = await getPeriodStats(alice.userId, { period: "month", date: "2026-11-05" });

    expect(stats).toMatchObject({
      period: "month",
      start: "2026-11-01",
      previous: "2026-10-01",
      next: "2026-12-01",
    });
    expect(stats.buckets).toHaveLength(30);
    // Everything of November except the deleted row; 2 (30/11 local) is in.
    expect(stats.totals.expense).toBe(10_000 + 20_000 + 30_000 + 2 + 1);
    expect(sum(stats.buckets.map((bucket) => bucket.expense))).toBe(stats.totals.expense);
  });
});

describe("getPeriodStats: year", () => {
  it("has twelve monthly buckets for the local year", async () => {
    const stats = await getPeriodStats(alice.userId, { period: "year", date: "2026-07-15" });

    expect(stats).toMatchObject({
      period: "year",
      start: "2026-01-01",
      previous: "2025-01-01",
      next: "2027-01-01",
    });
    expect(stats.buckets.map((bucket) => bucket.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(stats.buckets[2]).toEqual({ key: "2026-03", income: 0, expense: 40_000 });
    expect(stats.buckets[10]).toEqual({ key: "2026-11", income: 5_000_000, expense: 60_003 });
    expect(stats.totals).toEqual({ income: 5_000_000, expense: 100_003, balance: 4_899_997 });
  });

  it("uses the user's time zone at the year boundary", async () => {
    // 2025-12-31T16:59:59Z is still 2025 in Vietnam...
    const y2025 = await getPeriodStats(alice.userId, { period: "year", date: "2025-06-01" });
    expect(y2025.totals.expense).toBe(3);
    // ...but already 2026 in Tokyo (UTC+9).
    await prisma.user.update({ where: { id: alice.userId }, data: { timeZone: "Asia/Tokyo" } });
    const tokyo = await getPeriodStats(alice.userId, { period: "year", date: "2025-06-01" });
    expect(tokyo.totals.expense).toBe(0);
  });
});

describe("getPeriodStats: defaults and validation", () => {
  it("defaults to the current month in the user's time zone", async () => {
    const now = new Date("2026-11-30T18:00:00Z"); // 01/12 in Vietnam
    const stats = await getPeriodStats(alice.userId, {}, now);
    expect(stats).toMatchObject({ period: "month", start: "2026-12-01" });
  });

  it("never counts other users' or deleted transactions", async () => {
    const stats = await getPeriodStats(alice.userId, { period: "week", date: "2026-11-25" });
    expect(stats.buckets[2]).toEqual({ key: "2026-11-25", income: 0, expense: 20_000 });
    const bobs = await getPeriodStats(bob.userId, { period: "week", date: "2026-11-25" });
    expect(bobs.totals.expense).toBe(77_777);
  });

  it.each([
    ["period", { period: "day" }],
    ["date", { date: "2026-02-30" }],
    ["date", { date: "25/11/2026" }],
  ])("rejects an invalid %s", async (field, query) => {
    const error = await getPeriodStats(alice.userId, query).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.map((detail) => detail.field)).toEqual([field]);
  });
});
