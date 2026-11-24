import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { getDailyStats, getStatsByCategory, getSummary } from "@/server/stats/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;
let transport: string;
let bonus: string;

type Row = {
  amount: number;
  at: string;
  type?: "EXPENSE" | "INCOME";
  categoryId?: string;
  deleted?: boolean;
};

async function seed(user: UserFixture, rows: Row[]): Promise<void> {
  for (const row of rows) {
    const type = row.type ?? "EXPENSE";
    await prisma.transaction.create({
      data: {
        userId: user.userId,
        type,
        amount: row.amount,
        occurredAt: new Date(row.at),
        categoryId: row.categoryId ?? (type === "EXPENSE" ? user.food : user.salary),
        deletedAt: row.deleted ? new Date() : null,
      },
    });
  }
}

const categoryId = async (user: UserFixture, name: string, type: "EXPENSE" | "INCOME") =>
  (await prisma.category.findFirstOrThrow({ where: { userId: user.userId, name, type } })).id;

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
  transport = await categoryId(alice, "Đi lại", "EXPENSE");
  bonus = await categoryId(alice, "Thưởng", "INCOME");

  // Alice, Asia/Ho_Chi_Minh (UTC+7). November locally is
  // [2026-10-31T17:00Z, 2026-11-30T17:00Z).
  await seed(alice, [
    { amount: 111, at: "2026-10-31T16:59:59Z" }, // 31/10 local: October
    { amount: 45_000, at: "2026-10-31T17:00:00Z" }, // 01/11 00:00 local
    { amount: 30_000, at: "2026-11-01T05:00:00Z", categoryId: transport }, // 01/11
    { amount: 25_000, at: "2026-11-15T10:00:00Z" }, // 15/11
    { amount: 15_000_000, at: "2026-11-05T02:00:00Z", type: "INCOME" }, // 05/11
    { amount: 2_000_000, at: "2026-11-30T16:59:59Z", type: "INCOME", categoryId: bonus }, // 30/11 23:59
    { amount: 222, at: "2026-11-30T17:00:00Z" }, // 01/12 local: December
    { amount: 999_999, at: "2026-11-10T00:00:00Z", deleted: true }, // soft-deleted
    { amount: 888_888, at: "2026-11-10T00:00:00Z", type: "INCOME", deleted: true },
  ]);
  await seed(bob, [{ amount: 77_777, at: "2026-11-10T00:00:00Z" }]);
});

describe("getSummary", () => {
  it("matches the totals counted by hand, inside the local month only", async () => {
    // Expense: 45,000 + 30,000 + 25,000. Income: 15,000,000 + 2,000,000.
    await expect(getSummary(alice.userId, { month: "2026-11" })).resolves.toEqual({
      month: "2026-11",
      income: 17_000_000,
      expense: 100_000,
      balance: 16_900_000,
    });
  });

  it("puts boundary transactions in the neighbouring months", async () => {
    await expect(getSummary(alice.userId, { month: "2026-10" })).resolves.toMatchObject({
      expense: 111,
      income: 0,
    });
    await expect(getSummary(alice.userId, { month: "2026-12" })).resolves.toMatchObject({
      expense: 222,
      income: 0,
    });
  });

  it("follows the user's own time zone", async () => {
    await prisma.user.update({ where: { id: alice.userId }, data: { timeZone: "Europe/London" } });
    // London in November is UTC+0, so November is [11-01T00:00Z, 12-01T00:00Z):
    // 45,000 at 10-31T17:00Z moves to October, 222 at 11-30T17:00Z moves in.
    // Expense: 30,000 + 25,000 + 222.
    await expect(getSummary(alice.userId, { month: "2026-11" })).resolves.toMatchObject({
      expense: 55_222,
      income: 17_000_000,
    });
  });

  it("returns zeros for an empty month and can be negative", async () => {
    await expect(getSummary(alice.userId, { month: "2025-01" })).resolves.toEqual({
      month: "2025-01",
      income: 0,
      expense: 0,
      balance: 0,
    });
    await expect(getSummary(alice.userId, { month: "2026-10" })).resolves.toMatchObject({
      balance: -111,
    });
  });

  it("defaults to the current month in the user's time zone", async () => {
    const now = new Date("2026-11-30T18:00:00Z"); // already December locally
    await expect(getSummary(alice.userId, {}, now)).resolves.toMatchObject({
      month: "2026-12",
      expense: 222,
    });
  });

  it("rejects an invalid month", async () => {
    await expect(getSummary(alice.userId, { month: "2026-13" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("getStatsByCategory", () => {
  it("totals expenses per category, largest first, with percentages", async () => {
    const result = await getStatsByCategory(alice.userId, { month: "2026-11" });

    expect(result).toEqual({
      month: "2026-11",
      type: "EXPENSE",
      items: [
        { categoryId: alice.food, name: "Ăn uống", icon: "🍜", total: 70_000, percent: 70 },
        { categoryId: transport, name: "Đi lại", icon: "🛵", total: 30_000, percent: 30 },
      ],
    });
  });

  it("totals income when asked", async () => {
    const result = await getStatsByCategory(alice.userId, { month: "2026-11", type: "INCOME" });

    expect(result.items).toEqual([
      expect.objectContaining({ categoryId: alice.salary, total: 15_000_000, percent: 88.2 }),
      expect.objectContaining({ categoryId: bonus, total: 2_000_000, percent: 11.8 }),
    ]);
  });

  it("keeps archived categories, which old transactions still use", async () => {
    await prisma.category.update({ where: { id: transport }, data: { archivedAt: new Date() } });
    const result = await getStatsByCategory(alice.userId, { month: "2026-11" });
    expect(result.items.map((item) => item.categoryId)).toContain(transport);
  });

  it("is empty for a month without transactions", async () => {
    await expect(getStatsByCategory(alice.userId, { month: "2025-01" })).resolves.toMatchObject({
      items: [],
    });
  });

  it("rejects an unknown type", async () => {
    await expect(
      getStatsByCategory(alice.userId, { month: "2026-11", type: "TRANSFER" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getDailyStats", () => {
  it("has one entry per local day, with zero days filled in", async () => {
    const { month, days } = await getDailyStats(alice.userId, { month: "2026-11" });

    expect(month).toBe("2026-11");
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ date: "2026-11-01", income: 0, expense: 75_000 });
    expect(days[1]).toEqual({ date: "2026-11-02", income: 0, expense: 0 });
    expect(days[4]).toEqual({ date: "2026-11-05", income: 15_000_000, expense: 0 });
    expect(days[14]).toEqual({ date: "2026-11-15", income: 0, expense: 25_000 });
    expect(days[29]).toEqual({ date: "2026-11-30", income: 2_000_000, expense: 0 });
  });

  it("adds up to the summary", async () => {
    const [{ days }, summary] = await Promise.all([
      getDailyStats(alice.userId, { month: "2026-11" }),
      getSummary(alice.userId, { month: "2026-11" }),
    ]);
    expect(days.reduce((sum, day) => sum + day.expense, 0)).toBe(summary.expense);
    expect(days.reduce((sum, day) => sum + day.income, 0)).toBe(summary.income);
  });

  it("knows month lengths (February 2028 is a leap month)", async () => {
    expect((await getDailyStats(alice.userId, { month: "2028-02" })).days).toHaveLength(29);
    expect((await getDailyStats(alice.userId, { month: "2027-02" })).days).toHaveLength(28);
  });
});

describe("soft-deleted transactions and other users", () => {
  it("are never counted", async () => {
    const [summary, byCategory, income, daily] = await Promise.all([
      getSummary(alice.userId, { month: "2026-11" }),
      getStatsByCategory(alice.userId, { month: "2026-11" }),
      getStatsByCategory(alice.userId, { month: "2026-11", type: "INCOME" }),
      getDailyStats(alice.userId, { month: "2026-11" }),
    ]);

    // Without the deleted rows (999,999 and 888,888) and Bob's 77,777.
    expect(summary).toMatchObject({ expense: 100_000, income: 17_000_000 });
    expect(byCategory.items.reduce((sum, item) => sum + item.total, 0)).toBe(100_000);
    expect(income.items.reduce((sum, item) => sum + item.total, 0)).toBe(17_000_000);
    expect(daily.days[9]).toEqual({ date: "2026-11-10", income: 0, expense: 0 });

    await expect(getSummary(bob.userId, { month: "2026-11" })).resolves.toMatchObject({
      expense: 77_777,
      income: 0,
    });
  });
});
