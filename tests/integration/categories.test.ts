import { beforeEach, describe, expect, it } from "vitest";

import { upsertBudget } from "@/server/budgets/service";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listSelectableCategories,
  updateCategory,
} from "@/server/categories/service";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { createTransaction, deleteTransaction } from "@/server/transactions/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((e: unknown) => e);
}

function fields(error: unknown): string[] {
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

const spend = (user: UserFixture, categoryId: string, day = "05") =>
  createTransaction(user.userId, {
    type: "EXPENSE",
    amount: 10_000,
    categoryId,
    occurredAt: `2026-11-${day}T05:00:00Z`,
  });

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("listCategories", () => {
  it("lists the user's categories with how many transactions each has", async () => {
    await spend(alice, alice.food, "05");
    await spend(alice, alice.food, "06");
    const deleted = await spend(alice, alice.food, "07");
    await deleteTransaction(alice.userId, deleted.id); // soft-deleted rows do not count
    await spend(bob, bob.food);

    const categories = await listCategories(alice.userId);

    expect(categories.find((c) => c.id === alice.food)).toEqual({
      id: alice.food,
      name: "Ăn uống",
      type: "EXPENSE",
      icon: "🍜",
      transactionCount: 2,
    });
    expect(categories.find((c) => c.id === alice.salary)).toMatchObject({ transactionCount: 0 });
    expect(categories.map((c) => c.id)).not.toContain(bob.food);
  });
});

describe("createCategory", () => {
  it("creates a category for the user", async () => {
    const created = await createCategory(alice.userId, {
      name: "  Cà phê  ",
      type: "EXPENSE",
      icon: "☕",
    });

    expect(created).toEqual({
      id: expect.any(String),
      name: "Cà phê",
      type: "EXPENSE",
      icon: "☕",
      transactionCount: 0,
    });
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.userId).toBe(alice.userId);
  });

  it("returns 409 for a duplicate (name, type), but allows the same name for the other type", async () => {
    await expect(
      errorOf(createCategory(alice.userId, { name: "Ăn uống", type: "EXPENSE" })),
    ).resolves.toBeInstanceOf(ConflictError);
    await expect(
      createCategory(alice.userId, { name: "Ăn uống", type: "INCOME" }),
    ).resolves.toMatchObject({ name: "Ăn uống", type: "INCOME" });
    await expect(
      createCategory(bob.userId, { name: "Cà phê", type: "EXPENSE" }),
    ).resolves.toMatchObject({ name: "Cà phê" });
  });

  it("validates name, type and icon, and ignores a client userId", async () => {
    expect(
      fields(await errorOf(createCategory(alice.userId, { name: " ", type: "EXPENSE" }))),
    ).toEqual(["name"]);
    expect(
      fields(await errorOf(createCategory(alice.userId, { name: "X", type: "OTHER" }))),
    ).toEqual(["type"]);
    expect(
      fields(
        await errorOf(
          createCategory(alice.userId, { name: "X", type: "EXPENSE", icon: "x".repeat(17) }),
        ),
      ),
    ).toEqual(["icon"]);

    const created = await createCategory(alice.userId, {
      name: "Quà",
      type: "EXPENSE",
      userId: bob.userId,
    });
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.userId).toBe(alice.userId);
  });
});

describe("updateCategory", () => {
  it("renames and changes the icon", async () => {
    await expect(
      updateCategory(alice.userId, alice.food, { name: "Ăn ngoài", icon: "🍲" }),
    ).resolves.toMatchObject({ id: alice.food, name: "Ăn ngoài", icon: "🍲", type: "EXPENSE" });
  });

  it("returns 409 when renaming onto an existing name of the same type", async () => {
    await expect(
      errorOf(updateCategory(alice.userId, alice.food, { name: "Đi lại" })),
    ).resolves.toBeInstanceOf(ConflictError);
  });

  it("is 404 for another user's category and leaves it unchanged", async () => {
    await expect(
      errorOf(updateCategory(alice.userId, bob.food, { name: "Hacked" })),
    ).resolves.toBeInstanceOf(NotFoundError);
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: bob.food } });
    expect(stored.name).toBe("Ăn uống");
  });
});

describe("deleteCategory", () => {
  it("deletes an empty category for good, with its budgets", async () => {
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 1 });

    await deleteCategory(alice.userId, alice.food);

    expect(await prisma.category.findUnique({ where: { id: alice.food } })).toBeNull();
    expect(await prisma.budget.count({ where: { userId: alice.userId } })).toBe(0);
  });

  it("refuses while the category still has transactions, saying how many", async () => {
    await spend(alice, alice.food, "05");
    await spend(alice, alice.food, "06");

    const error = await errorOf(deleteCategory(alice.userId, alice.food));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toContain("2 giao dịch");
    await expect(listCategories(alice.userId)).resolves.toContainEqual(
      expect.objectContaining({ id: alice.food }),
    );
  });

  it("hides a category kept only by deleted transactions and frees its name", async () => {
    const tx = await spend(alice, alice.food);
    await deleteTransaction(alice.userId, tx.id);
    await upsertBudget(alice.userId, { categoryId: alice.food, month: "2026-11", amount: 1 });

    await deleteCategory(alice.userId, alice.food);

    // Gone from every list and picker, budgets removed, the deleted transaction still valid.
    expect((await listCategories(alice.userId)).map((c) => c.id)).not.toContain(alice.food);
    expect((await listSelectableCategories(alice.userId)).map((c) => c.id)).not.toContain(
      alice.food,
    );
    expect(await prisma.budget.count({ where: { userId: alice.userId } })).toBe(0);
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(stored.categoryId).toBe(alice.food);
    // The same name can be used again.
    await expect(
      createCategory(alice.userId, { name: "Ăn uống", type: "EXPENSE" }),
    ).resolves.toMatchObject({ name: "Ăn uống" });
    // A hidden category cannot be used, edited or deleted again.
    await expect(errorOf(spend(alice, alice.food))).resolves.toBeInstanceOf(ValidationError);
    await expect(
      errorOf(updateCategory(alice.userId, alice.food, { name: "X" })),
    ).resolves.toBeInstanceOf(NotFoundError);
    await expect(errorOf(deleteCategory(alice.userId, alice.food))).resolves.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("is 404 for another user's category, which stays", async () => {
    await expect(errorOf(deleteCategory(alice.userId, bob.food))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    await expect(prisma.category.findUnique({ where: { id: bob.food } })).resolves.not.toBeNull();
  });
});
