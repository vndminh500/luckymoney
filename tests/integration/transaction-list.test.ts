import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { listTransactions } from "@/server/transactions/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;

type Seed = {
  amount: number;
  occurredAt: string;
  type?: "EXPENSE" | "INCOME";
  categoryId?: string;
  note?: string;
  deletedAt?: Date;
};

/** Inserts directly so tests can use any date and soft-deleted rows. */
async function seed(user: UserFixture, rows: Seed[]): Promise<string[]> {
  const ids: string[] = [];
  for (const row of rows) {
    const type = row.type ?? "EXPENSE";
    const created = await prisma.transaction.create({
      data: {
        userId: user.userId,
        type,
        amount: row.amount,
        occurredAt: new Date(row.occurredAt),
        categoryId: row.categoryId ?? (type === "EXPENSE" ? user.food : user.salary),
        note: row.note ?? null,
        deletedAt: row.deletedAt ?? null,
      },
    });
    ids.push(created.id);
  }
  return ids;
}

const amounts = (result: { items: { amount: number }[] }) => result.items.map((i) => i.amount);

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("listTransactions", () => {
  it("returns the month's transactions, newest first, with their category", async () => {
    await seed(alice, [
      { amount: 1_000, occurredAt: "2026-11-02T03:00:00Z", note: "Sáng" },
      { amount: 2_000, occurredAt: "2026-11-20T03:00:00Z" },
      { amount: 3_000, occurredAt: "2026-11-10T03:00:00Z" },
    ]);

    const result = await listTransactions(alice.userId, { month: "2026-11" });

    expect(amounts(result)).toEqual([2_000, 3_000, 1_000]);
    expect(result).toMatchObject({
      month: "2026-11",
      timeZone: "Asia/Ho_Chi_Minh",
      page: 1,
      pageSize: 20,
      total: 3,
    });
    expect(result.items[2]).toEqual({
      id: expect.any(String),
      type: "EXPENSE",
      amount: 1_000,
      occurredAt: new Date("2026-11-02T03:00:00Z"),
      note: "Sáng",
      category: { id: alice.food, name: "Ăn uống", icon: "🍜" },
    });
    expect(result.items[0]).not.toHaveProperty("userId");
  });

  it("groups by month in the user's time zone, not UTC", async () => {
    // Asia/Ho_Chi_Minh is UTC+7: 2026-10-31 17:00 UTC is 2026-11-01 00:00 local.
    await seed(alice, [
      { amount: 1, occurredAt: "2026-10-31T16:59:59Z" }, // October locally
      { amount: 2, occurredAt: "2026-10-31T17:00:00Z" }, // November locally
      { amount: 3, occurredAt: "2026-11-30T16:59:59Z" }, // November locally
      { amount: 4, occurredAt: "2026-11-30T17:00:00Z" }, // December locally
    ]);

    expect(amounts(await listTransactions(alice.userId, { month: "2026-11" }))).toEqual([3, 2]);
    expect(amounts(await listTransactions(alice.userId, { month: "2026-10" }))).toEqual([1]);
    expect(amounts(await listTransactions(alice.userId, { month: "2026-12" }))).toEqual([4]);
  });

  it("defaults to the current month in the user's time zone", async () => {
    await seed(alice, [
      { amount: 1, occurredAt: "2026-11-30T16:00:00Z" },
      { amount: 2, occurredAt: "2026-12-01T00:00:00Z" },
    ]);
    // 2026-11-30 18:00 UTC is already December in Asia/Ho_Chi_Minh.
    const now = new Date("2026-11-30T18:00:00Z");

    const result = await listTransactions(alice.userId, {}, now);

    expect(result.month).toBe("2026-12");
    expect(amounts(result)).toEqual([2]);
  });

  it("never returns another user's transactions", async () => {
    await seed(alice, [{ amount: 1, occurredAt: "2026-11-05T00:00:00Z" }]);
    await seed(bob, [{ amount: 999, occurredAt: "2026-11-05T00:00:00Z" }]);

    expect(amounts(await listTransactions(alice.userId, { month: "2026-11" }))).toEqual([1]);
    // Filtering by Bob's category id does not leak Bob's data either.
    const byBobsCategory = await listTransactions(alice.userId, {
      month: "2026-11",
      categoryId: bob.food,
    });
    expect(byBobsCategory).toMatchObject({ items: [], total: 0 });
  });

  it("skips soft-deleted transactions", async () => {
    await seed(alice, [
      { amount: 1, occurredAt: "2026-11-05T00:00:00Z" },
      { amount: 2, occurredAt: "2026-11-06T00:00:00Z", deletedAt: new Date() },
    ]);

    const result = await listTransactions(alice.userId, { month: "2026-11" });
    expect(amounts(result)).toEqual([1]);
    expect(result.total).toBe(1);
  });

  it("filters by type and by category", async () => {
    await seed(alice, [
      { amount: 1, occurredAt: "2026-11-05T00:00:00Z" },
      { amount: 2, occurredAt: "2026-11-06T00:00:00Z", type: "INCOME" },
    ]);

    expect(
      amounts(await listTransactions(alice.userId, { month: "2026-11", type: "INCOME" })),
    ).toEqual([2]);
    expect(
      amounts(await listTransactions(alice.userId, { month: "2026-11", categoryId: alice.food })),
    ).toEqual([1]);
  });

  it("paginates with a stable order and reports the total", async () => {
    // Same occurredAt for all rows: the order must still be deterministic across pages.
    await seed(
      alice,
      Array.from({ length: 5 }, (_, i) => ({ amount: i + 1, occurredAt: "2026-11-05T00:00:00Z" })),
    );

    const page1 = await listTransactions(alice.userId, { month: "2026-11", pageSize: "2" });
    const page2 = await listTransactions(alice.userId, {
      month: "2026-11",
      pageSize: "2",
      page: "2",
    });
    const page3 = await listTransactions(alice.userId, {
      month: "2026-11",
      pageSize: "2",
      page: "3",
    });

    expect(page1).toMatchObject({ page: 1, pageSize: 2, total: 5 });
    const all = [...amounts(page1), ...amounts(page2), ...amounts(page3)];
    expect(all).toHaveLength(5);
    expect(new Set(all).size).toBe(5);
    expect(amounts(page3)).toHaveLength(1);
  });

  it.each([
    ["month", { month: "2026-13" }],
    ["type", { type: "TRANSFER" }],
    ["page", { page: "0" }],
    ["pageSize", { pageSize: "101" }],
  ])("rejects an invalid %s", async (field, query) => {
    const error = await listTransactions(alice.userId, query).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.map((d) => d.field)).toEqual([field]);
  });
});
