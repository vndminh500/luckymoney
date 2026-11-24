import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteBudget,
  listBudgets,
  upsertBudget,
  upsertBudgetFromForm,
} from "@/server/budgets/service";
import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;

async function spend(user: UserFixture, amount: number, at: string, deleted = false) {
  await prisma.transaction.create({
    data: {
      userId: user.userId,
      type: "EXPENSE",
      amount,
      categoryId: user.food,
      occurredAt: new Date(at),
      deletedAt: deleted ? new Date() : null,
    },
  });
}

async function fields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("upsertBudget", () => {
  it("creates a budget, then updates the same (category, month) instead of duplicating", async () => {
    const created = await upsertBudget(alice.userId, {
      categoryId: alice.food,
      month: "2026-11",
      amount: 2_000_000,
    });
    const updated = await upsertBudget(alice.userId, {
      categoryId: alice.food,
      month: "2026-11",
      amount: 3_000_000,
    });

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({ amount: 3_000_000, month: "2026-11" });
    expect(await prisma.budget.count({ where: { userId: alice.userId } })).toBe(1);
  });

  it("validates amount and month", async () => {
    const base = { categoryId: alice.food, month: "2026-11", amount: 1 };
    await expect(fields(upsertBudget(alice.userId, { ...base, amount: 0 }))).resolves.toEqual([
      "amount",
    ]);
    await expect(fields(upsertBudget(alice.userId, { ...base, amount: 1.5 }))).resolves.toEqual([
      "amount",
    ]);
    await expect(
      fields(upsertBudget(alice.userId, { ...base, month: "2026-13" })),
    ).resolves.toEqual(["month"]);
  });

  it("only accepts the user's own, active expense categories", async () => {
    const base = { month: "2026-11", amount: 100_000 };
    for (const categoryId of [bob.food, alice.salary, "nope"]) {
      await expect(fields(upsertBudget(alice.userId, { ...base, categoryId }))).resolves.toEqual([
        "categoryId",
      ]);
    }
    await prisma.category.update({ where: { id: alice.food }, data: { archivedAt: new Date() } });
    await expect(
      fields(upsertBudget(alice.userId, { ...base, categoryId: alice.food })),
    ).resolves.toEqual(["categoryId"]);
    expect(await prisma.budget.count()).toBe(0);
  });

  it("ignores a userId from the client", async () => {
    const budget = await upsertBudget(alice.userId, {
      categoryId: alice.food,
      month: "2026-11",
      amount: 1,
      userId: bob.userId,
    });
    const stored = await prisma.budget.findUniqueOrThrow({ where: { id: budget.id } });
    expect(stored.userId).toBe(alice.userId);
  });
});

describe("upsertBudgetFromForm", () => {
  it("parses shorthand amounts", async () => {
    await expect(
      upsertBudgetFromForm(alice.userId, {
        categoryId: alice.food,
        month: "2026-11",
        amount: "2tr5",
      }),
    ).resolves.toMatchObject({ amount: 2_500_000 });
  });

  it("reports an unreadable amount on the amount field", async () => {
    await expect(
      fields(
        upsertBudgetFromForm(alice.userId, {
          categoryId: alice.food,
          month: "2026-11",
          amount: "abc",
        }),
      ),
    ).resolves.toEqual(["amount"]);
  });
});

describe("listBudgets", () => {
  it("adds spent, percentUsed and status from the month's expenses in the user's time zone", async () => {
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 100_000 });
    await spend(alice, 50_000, "2026-10-31T17:00:00Z"); // 01/11 00:00 local: counts
    await spend(alice, 30_000, "2026-11-20T05:00:00Z");
    await spend(alice, 9_999, "2026-10-31T16:59:59Z"); // October locally: does not count
    await spend(alice, 500_000, "2026-11-21T05:00:00Z", true); // deleted: does not count
    await spend(bob, 70_000, "2026-11-20T05:00:00Z"); // Bob's: does not count

    const { month, items } = await listBudgets(alice.userId, { month: "2026-11" });

    expect(month).toBe("2026-11");
    expect(items).toEqual([
      {
        id: expect.any(String),
        categoryId: alice.food,
        name: "Ăn uống",
        icon: "🍜",
        archived: false,
        month: "2026-11",
        amount: 100_000,
        spent: 80_000,
        percentUsed: 80,
        status: "warning",
      },
    ]);
  });

  it.each([
    [79_999, 79.9, "ok"],
    [80_000, 80, "warning"],
    [99_999, 99.9, "warning"],
    [100_000, 100, "over"],
    [130_000, 130, "over"],
  ] as const)("spent %i of 100,000 is %d%% (%s)", async (spent, percent, status) => {
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 100_000 });
    await spend(alice, spent, "2026-11-20T05:00:00Z");

    const [item] = (await listBudgets(alice.userId, { month: "2026-11" })).items;
    expect(item).toMatchObject({ spent, percentUsed: percent, status });
  });

  it("only lists the month's budgets of the user, with zero spending when nothing was spent", async () => {
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 100_000 });
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-12", amount: 1 });
    await upsertBudget(bob.userId, { categoryId: bob.food, month: "2026-11", amount: 1 });

    const { items } = await listBudgets(alice.userId, { month: "2026-11" });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ spent: 0, percentUsed: 0, status: "ok" });
  });

  it("keeps a budget whose category was archived later", async () => {
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 100_000 });
    await prisma.category.update({ where: { id: alice.food }, data: { archivedAt: new Date() } });

    const { items } = await listBudgets(alice.userId, { month: "2026-11" });
    expect(items[0]).toMatchObject({ categoryId: alice.food, archived: true });
  });
});

describe("deleteBudget", () => {
  it("deletes the user's budget", async () => {
    const budget = await upsertBudget(alice.userId, {
      categoryId: alice.food,
      month: "2026-11",
      amount: 1,
    });
    await deleteBudget(alice.userId, budget.id);
    expect(await prisma.budget.count()).toBe(0);
  });

  it("is 404 for another user's budget, which stays", async () => {
    const budget = await upsertBudget(bob.userId, {
      categoryId: bob.food,
      month: "2026-11",
      amount: 1,
    });
    await expect(deleteBudget(alice.userId, budget.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.budget.count()).toBe(1);
  });
});
