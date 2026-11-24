import { beforeEach, describe, expect, it } from "vitest";

import {
  archiveCategory,
  createCategory,
  listCategories,
  listSelectableCategories,
  restoreCategory,
  updateCategory,
} from "@/server/categories/service";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { createTransaction, listTransactions } from "@/server/transactions/service";

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

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("listCategories", () => {
  it("lists the user's active categories, or all of them with includeArchived", async () => {
    await archiveCategory(alice.userId, alice.food);

    const active = await listCategories(alice.userId, {});
    const all = await listCategories(alice.userId, { includeArchived: "true" });

    expect(active.map((c) => c.id)).not.toContain(alice.food);
    expect(all.find((c) => c.id === alice.food)).toEqual({
      id: alice.food,
      name: "Ăn uống",
      type: "EXPENSE",
      icon: "🍜",
      archived: true,
    });
    expect(all).toHaveLength(active.length + 1);
    expect(all.map((c) => c.id)).not.toContain(bob.food);
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
      archived: false,
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
    // Another user's names do not matter.
    await expect(
      createCategory(bob.userId, { name: "Cà phê", type: "EXPENSE" }),
    ).resolves.toMatchObject({ name: "Cà phê" });
  });

  it("validates name, type and icon, and ignores a client userId", async () => {
    expect(
      fields(await errorOf(createCategory(alice.userId, { name: " ", type: "EXPENSE" }))),
    ).toEqual(["name"]);
    expect(
      fields(
        await errorOf(createCategory(alice.userId, { name: "a".repeat(51), type: "EXPENSE" })),
      ),
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

  it("needs at least one field and never changes the type", async () => {
    expect(fields(await errorOf(updateCategory(alice.userId, alice.food, {})))).toEqual(["body"]);
    await updateCategory(alice.userId, alice.food, { name: "Ăn", type: "INCOME" });
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: alice.food } });
    expect(stored.type).toBe("EXPENSE");
  });

  it("is 404 for another user's category and leaves it unchanged", async () => {
    await expect(
      errorOf(updateCategory(alice.userId, bob.food, { name: "Hacked" })),
    ).resolves.toBeInstanceOf(NotFoundError);
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: bob.food } });
    expect(stored.name).toBe("Ăn uống");
  });
});

describe("archiveCategory and restoreCategory", () => {
  it("archived categories cannot be picked for new transactions but stay on old ones", async () => {
    const old = await createTransaction(alice.userId, {
      type: "EXPENSE",
      amount: 10_000,
      categoryId: alice.food,
      occurredAt: "2026-11-05T00:00:00Z",
    });

    await expect(archiveCategory(alice.userId, alice.food)).resolves.toMatchObject({
      archived: true,
    });

    const selectable = await listSelectableCategories(alice.userId);
    expect(selectable.map((c) => c.id)).not.toContain(alice.food);
    const newOne = await errorOf(
      createTransaction(alice.userId, {
        type: "EXPENSE",
        amount: 10_000,
        categoryId: alice.food,
        occurredAt: "2026-11-06T00:00:00Z",
      }),
    );
    expect(fields(newOne)).toEqual(["categoryId"]);

    const list = await listTransactions(alice.userId, { month: "2026-11" });
    expect(list.items).toEqual([
      expect.objectContaining({
        id: old.id,
        category: { id: alice.food, name: "Ăn uống", icon: "🍜", archived: true },
      }),
    ]);
  });

  it("restore makes the category selectable again", async () => {
    await archiveCategory(alice.userId, alice.food);
    await expect(restoreCategory(alice.userId, alice.food)).resolves.toMatchObject({
      archived: false,
    });
    expect((await listSelectableCategories(alice.userId)).map((c) => c.id)).toContain(alice.food);
  });

  it("is idempotent", async () => {
    await archiveCategory(alice.userId, alice.food);
    const first = await prisma.category.findUniqueOrThrow({ where: { id: alice.food } });
    await archiveCategory(alice.userId, alice.food);
    const second = await prisma.category.findUniqueOrThrow({ where: { id: alice.food } });
    expect(second.archivedAt).toEqual(first.archivedAt);
    await restoreCategory(alice.userId, alice.food);
    await expect(restoreCategory(alice.userId, alice.food)).resolves.toMatchObject({
      archived: false,
    });
  });

  it("is 404 for another user's category and leaves it unchanged", async () => {
    await expect(errorOf(archiveCategory(alice.userId, bob.food))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    await prisma.category.update({ where: { id: bob.salary }, data: { archivedAt: new Date() } });
    await expect(errorOf(restoreCategory(alice.userId, bob.salary))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    const [food, salary] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { id: bob.food } }),
      prisma.category.findUniqueOrThrow({ where: { id: bob.salary } }),
    ]);
    expect(food.archivedAt).toBeNull();
    expect(salary.archivedAt).not.toBeNull();
  });
});
