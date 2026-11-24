import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
  updateTransactionFromForm,
} from "@/server/transactions/service";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;
let aliceTx: string;

async function insert(user: UserFixture, occurredAt = "2026-11-10T05:30:00Z"): Promise<string> {
  const row = await prisma.transaction.create({
    data: {
      userId: user.userId,
      type: "EXPENSE",
      amount: 50_000,
      categoryId: user.food,
      occurredAt: new Date(occurredAt),
      note: "Phở",
    },
  });
  return row.id;
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((e: unknown) => e);
}

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
  aliceTx = await insert(alice);
});

describe("getTransaction", () => {
  it("returns the user's transaction with its category", async () => {
    await expect(getTransaction(alice.userId, aliceTx)).resolves.toEqual({
      id: aliceTx,
      type: "EXPENSE",
      amount: 50_000,
      occurredAt: new Date("2026-11-10T05:30:00Z"),
      note: "Phở",
      category: { id: alice.food, name: "Ăn uống", icon: "🍜" },
    });
  });

  it("is 404 for another user's, unknown and soft-deleted transactions", async () => {
    await expect(errorOf(getTransaction(bob.userId, aliceTx))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    await expect(errorOf(getTransaction(alice.userId, "nope"))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    await deleteTransaction(alice.userId, aliceTx);
    await expect(errorOf(getTransaction(alice.userId, aliceTx))).resolves.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("updateTransaction", () => {
  it("changes only the given fields", async () => {
    const updated = await updateTransaction(alice.userId, aliceTx, { amount: 65_000, note: null });

    expect(updated).toMatchObject({
      id: aliceTx,
      amount: 65_000,
      note: null,
      categoryId: alice.food,
      occurredAt: new Date("2026-11-10T05:30:00Z"),
    });
  });

  it("switches type together with a matching category", async () => {
    const updated = await updateTransaction(alice.userId, aliceTx, {
      type: "INCOME",
      categoryId: alice.salary,
    });
    expect(updated).toMatchObject({ type: "INCOME", categoryId: alice.salary });
  });

  it("rejects a type change that no longer matches the category", async () => {
    const error = await errorOf(updateTransaction(alice.userId, aliceTx, { type: "INCOME" }));
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.map((d) => d.field)).toEqual(["categoryId"]);
  });

  it("validates the same rules as create", async () => {
    for (const input of [{ amount: 0 }, { note: "a".repeat(201) }, {}]) {
      await expect(
        errorOf(updateTransaction(alice.userId, aliceTx, input)),
      ).resolves.toBeInstanceOf(ValidationError);
    }
    for (const categoryId of [bob.food, "nope"]) {
      const error = await errorOf(updateTransaction(alice.userId, aliceTx, { categoryId }));
      expect((error as ValidationError).details.map((d) => d.field)).toEqual(["categoryId"]);
    }
  });

  it("does not let another user change the transaction", async () => {
    const error = await errorOf(updateTransaction(bob.userId, aliceTx, { amount: 1 }));

    expect(error).toBeInstanceOf(NotFoundError);
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: aliceTx } });
    expect(stored.amount).toBe(50_000);
  });

  it("does not update a soft-deleted transaction", async () => {
    await deleteTransaction(alice.userId, aliceTx);
    await expect(
      errorOf(updateTransaction(alice.userId, aliceTx, { amount: 1 })),
    ).resolves.toBeInstanceOf(NotFoundError);
  });
});

describe("updateTransactionFromForm", () => {
  const form = {
    type: "EXPENSE",
    amount: "70k",
    categoryId: "",
    date: "2026-11-10",
    note: "Bún",
  };

  it("keeps the original time when the day is unchanged", async () => {
    const updated = await updateTransactionFromForm(alice.userId, aliceTx, {
      ...form,
      categoryId: alice.food,
    });
    expect(updated).toMatchObject({
      amount: 70_000,
      note: "Bún",
      occurredAt: new Date("2026-11-10T05:30:00Z"),
    });
  });

  it("moves to the start of the new day in the user's time zone", async () => {
    const updated = await updateTransactionFromForm(alice.userId, aliceTx, {
      ...form,
      categoryId: alice.food,
      date: "2026-12-01",
    });
    expect(updated.occurredAt).toEqual(new Date("2026-11-30T17:00:00Z"));
  });

  it("is 404 for another user's transaction", async () => {
    await expect(
      errorOf(updateTransactionFromForm(bob.userId, aliceTx, { ...form, categoryId: bob.food })),
    ).resolves.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteTransaction", () => {
  it("soft-deletes: the row stays, but the list no longer shows it", async () => {
    const other = await insert(alice, "2026-11-11T00:00:00Z");

    await deleteTransaction(alice.userId, aliceTx);

    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: aliceTx } });
    expect(stored.deletedAt).toBeInstanceOf(Date);
    const list = await listTransactions(alice.userId, { month: "2026-11" });
    expect(list.items.map((item) => item.id)).toEqual([other]);
    expect(list.total).toBe(1);
  });

  it("does not let another user delete the transaction", async () => {
    await expect(errorOf(deleteTransaction(bob.userId, aliceTx))).resolves.toBeInstanceOf(
      NotFoundError,
    );
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: aliceTx } });
    expect(stored.deletedAt).toBeNull();
  });

  it("is 404 the second time", async () => {
    await deleteTransaction(alice.userId, aliceTx);
    await expect(errorOf(deleteTransaction(alice.userId, aliceTx))).resolves.toBeInstanceOf(
      NotFoundError,
    );
  });
});
