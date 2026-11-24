import { beforeEach, describe, expect, it } from "vitest";

import { registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { listSelectableCategories } from "@/server/categories/service";
import {
  createTransaction,
  createTransactionFromForm,
  getTodayKeyForUser,
} from "@/server/transactions/service";

type Ids = { userId: string; food: string; salary: string };

let alice: Ids;
let bob: Ids;

async function createUserWithCategories(email: string): Promise<Ids> {
  const user = await registerUser({ email, password: "mat-khau-an-toan" });
  const find = async (name: string, type: "EXPENSE" | "INCOME") =>
    (await prisma.category.findFirstOrThrow({ where: { userId: user.id, name, type } })).id;
  return {
    userId: user.id,
    food: await find("Ăn uống", "EXPENSE"),
    salary: await find("Lương", "INCOME"),
  };
}

function validInput(ids: Ids) {
  return {
    type: "EXPENSE",
    amount: 50_000,
    categoryId: ids.food,
    occurredAt: "2026-11-24T05:00:00.000Z",
    note: "Phở",
  };
}

async function validationFields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
});

describe("createTransaction", () => {
  it("stores the transaction for the signed-in user and returns it", async () => {
    const created = await createTransaction(alice.userId, validInput(alice));

    expect(created).toEqual({
      id: expect.any(String),
      type: "EXPENSE",
      amount: 50_000,
      categoryId: alice.food,
      occurredAt: new Date("2026-11-24T05:00:00.000Z"),
      note: "Phở",
      createdAt: expect.any(Date),
    });
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.userId).toBe(alice.userId);
    expect(stored.deletedAt).toBeNull();
  });

  it("stores an income in an income category", async () => {
    const created = await createTransaction(alice.userId, {
      ...validInput(alice),
      type: "INCOME",
      amount: 15_000_000,
      categoryId: alice.salary,
    });
    expect(created).toMatchObject({ type: "INCOME", amount: 15_000_000 });
  });

  it.each([0, -50_000])("rejects amount %s", async (amount) => {
    await expect(
      validationFields(createTransaction(alice.userId, { ...validInput(alice), amount })),
    ).resolves.toEqual(["amount"]);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("rejects a category that belongs to another user, with the same error as an unknown one", async () => {
    const otherUsers = await createTransaction(alice.userId, {
      ...validInput(alice),
      categoryId: bob.food,
    }).catch((e: unknown) => e);
    const unknown = await createTransaction(alice.userId, {
      ...validInput(alice),
      categoryId: "does-not-exist",
    }).catch((e: unknown) => e);

    expect(otherUsers).toBeInstanceOf(ValidationError);
    expect((otherUsers as ValidationError).details).toEqual([
      { field: "categoryId", message: expect.any(String) },
    ]);
    expect((otherUsers as ValidationError).details).toEqual((unknown as ValidationError).details);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("rejects an archived category", async () => {
    await prisma.category.update({ where: { id: alice.food }, data: { archivedAt: new Date() } });

    await expect(
      validationFields(createTransaction(alice.userId, validInput(alice))),
    ).resolves.toEqual(["categoryId"]);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("rejects a category whose type does not match the transaction type", async () => {
    await expect(
      validationFields(
        createTransaction(alice.userId, { ...validInput(alice), categoryId: alice.salary }),
      ),
    ).resolves.toEqual(["categoryId"]);
  });

  it("ignores a userId sent by the client", async () => {
    const created = await createTransaction(alice.userId, {
      ...validInput(alice),
      userId: bob.userId,
    });
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.userId).toBe(alice.userId);
  });
});

describe("createTransactionFromForm", () => {
  const form = (ids: Ids) => ({
    type: "EXPENSE",
    amount: "1tr5",
    categoryId: ids.food,
    date: "2026-11-01",
    note: "",
  });

  it("parses the amount and stores the start of the day in the user's time zone", async () => {
    const created = await createTransactionFromForm(alice.userId, form(alice));

    // 2026-11-01 00:00 in Asia/Ho_Chi_Minh (UTC+7) is 2026-10-31 17:00 UTC.
    expect(created.occurredAt).toEqual(new Date("2026-10-31T17:00:00.000Z"));
    expect(created.amount).toBe(1_500_000);
    expect(created.note).toBeNull();
  });

  it("uses the user's own time zone", async () => {
    await prisma.user.update({ where: { id: alice.userId }, data: { timeZone: "Europe/London" } });
    const created = await createTransactionFromForm(alice.userId, form(alice));
    expect(created.occurredAt).toEqual(new Date("2026-11-01T00:00:00.000Z"));
  });

  it("reports errors under the form's field names", async () => {
    await expect(
      validationFields(
        createTransactionFromForm(alice.userId, { ...form(alice), amount: "abc", date: "" }),
      ),
    ).resolves.toEqual(["amount", "date"]);
  });

  it("rejects another user's category", async () => {
    await expect(
      validationFields(
        createTransactionFromForm(alice.userId, { ...form(alice), categoryId: bob.food }),
      ),
    ).resolves.toEqual(["categoryId"]);
  });
});

describe("listSelectableCategories", () => {
  it("returns only the user's own categories that are not archived", async () => {
    await prisma.category.update({ where: { id: alice.food }, data: { archivedAt: new Date() } });

    const categories = await listSelectableCategories(alice.userId);
    const ids = categories.map((category) => category.id);

    expect(ids).not.toContain(alice.food);
    expect(ids).toContain(alice.salary);
    expect(ids).not.toContain(bob.salary);
    expect(categories[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.stringMatching(/^(EXPENSE|INCOME)$/),
      icon: expect.any(String),
    });
  });
});

describe("getTodayKeyForUser", () => {
  it("returns today's date in the user's time zone, not UTC", async () => {
    // 2026-11-30 18:00 UTC is already 2026-12-01 in Asia/Ho_Chi_Minh.
    const now = new Date("2026-11-30T18:00:00.000Z");
    await expect(getTodayKeyForUser(alice.userId, now)).resolves.toBe("2026-12-01");
  });
});
