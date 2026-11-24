import { beforeEach, describe, expect, it } from "vitest";

import { registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import {
  addEntry,
  createJar,
  deleteEntry,
  deleteJar,
  getJar,
  listJars,
  updateJar,
} from "@/server/savings/service";

let aliceId: string;
let bobId: string;

async function fields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

async function rejectsWith(
  promise: Promise<unknown>,
  type: abstract new (...args: never[]) => Error,
) {
  await expect(promise.catch((e: unknown) => e)).resolves.toBeInstanceOf(type);
}

beforeEach(async () => {
  aliceId = (await registerUser({ email: "alice@example.com", password: "mat-khau-an-toan" })).id;
  bobId = (await registerUser({ email: "bob@example.com", password: "mat-khau-an-toan" })).id;
});

describe("jars", () => {
  it("creates a jar with a trimmed name and an optional icon", async () => {
    const jar = await createJar(aliceId, { name: "  Quỹ khẩn cấp ", icon: "🛟", userId: bobId });
    expect(jar).toMatchObject({ name: "Quỹ khẩn cấp", icon: "🛟", balance: 0 });
    expect((await prisma.savingsJar.findUniqueOrThrow({ where: { id: jar.id } })).userId).toBe(
      aliceId,
    );
  });

  it("refuses an empty name and a duplicate name of the same user", async () => {
    await expect(fields(createJar(aliceId, { name: " " }))).resolves.toEqual(["name"]);
    await createJar(aliceId, { name: "Du lịch" });
    await rejectsWith(createJar(aliceId, { name: "Du lịch" }), ConflictError);
    // Another user may use the same name.
    await expect(createJar(bobId, { name: "Du lịch" })).resolves.toMatchObject({ balance: 0 });
  });

  it("lists the user's jars with balances, the total and the last activity", async () => {
    const trip = await createJar(aliceId, { name: "Du lịch" });
    const rainy = await createJar(aliceId, { name: "Quỹ khẩn cấp" });
    await addEntry(aliceId, trip.id, { kind: "DEPOSIT", amount: "2tr", occurredOn: "2026-11-01" });
    await addEntry(aliceId, trip.id, {
      kind: "WITHDRAW",
      amount: 500_000,
      occurredOn: "2026-11-10",
    });
    await addEntry(aliceId, rainy.id, {
      kind: "DEPOSIT",
      amount: 5_000_000,
      occurredOn: "2026-10-01",
    });
    await createJar(bobId, { name: "Của Bob" });

    const { jars, total } = await listJars(aliceId);

    expect(total).toBe(6_500_000);
    // Largest balance first.
    expect(jars.map((jar) => [jar.name, jar.balance, jar.lastActivity])).toEqual([
      ["Quỹ khẩn cấp", 5_000_000, "2026-10-01"],
      ["Du lịch", 1_500_000, "2026-11-10"],
    ]);
  });

  it("renames a jar and changes its icon", async () => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    await updateJar(aliceId, jar.id, { name: "Du lịch Đà Lạt", icon: "🏔️" });
    await expect(getJar(aliceId, jar.id)).resolves.toMatchObject({
      name: "Du lịch Đà Lạt",
      icon: "🏔️",
    });
  });

  it("deletes a jar with its history", async () => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    await addEntry(aliceId, jar.id, { kind: "DEPOSIT", amount: 1_000, occurredOn: "2026-11-01" });
    await deleteJar(aliceId, jar.id);
    expect(await prisma.savingsJar.count()).toBe(0);
    expect(await prisma.savingsEntry.count()).toBe(0);
  });
});

describe("deposits and withdrawals", () => {
  it("keeps the history newest first with the running balance", async () => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    await addEntry(aliceId, jar.id, {
      kind: "DEPOSIT",
      amount: 1_000_000,
      occurredOn: "2026-11-01",
      note: "Lương",
    });
    await addEntry(aliceId, jar.id, {
      kind: "WITHDRAW",
      amount: 300_000,
      occurredOn: "2026-11-05",
    });

    const detail = await getJar(aliceId, jar.id);
    expect(detail.balance).toBe(700_000);
    expect(detail.deposited).toBe(1_000_000);
    expect(detail.withdrawn).toBe(300_000);
    expect(
      detail.entries.map((e) => [e.kind, e.amount, e.occurredOn, e.note, e.balanceAfter]),
    ).toEqual([
      ["WITHDRAW", 300_000, "2026-11-05", null, 700_000],
      ["DEPOSIT", 1_000_000, "2026-11-01", "Lương", 1_000_000],
    ]);
  });

  it("cannot withdraw more than the balance", async () => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    await addEntry(aliceId, jar.id, { kind: "DEPOSIT", amount: 100_000, occurredOn: "2026-11-01" });
    await expect(
      fields(
        addEntry(aliceId, jar.id, { kind: "WITHDRAW", amount: 100_001, occurredOn: "2026-11-02" }),
      ),
    ).resolves.toEqual(["amount"]);
  });

  it.each([
    ["amount", { amount: 0 }],
    ["amount", { amount: "abc" }],
    ["kind", { kind: "STEAL" }],
    ["occurredOn", { occurredOn: "2026-02-30" }],
  ])("rejects an invalid %s", async (field, change) => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    const entry = { kind: "DEPOSIT", amount: 1_000, occurredOn: "2026-11-01", ...change };
    await expect(fields(addEntry(aliceId, jar.id, entry))).resolves.toContain(field);
  });

  it("undoes an entry, but not a deposit whose money was already taken out", async () => {
    const jar = await createJar(aliceId, { name: "Du lịch" });
    const deposit = await addEntry(aliceId, jar.id, {
      kind: "DEPOSIT",
      amount: 500_000,
      occurredOn: "2026-11-01",
    });
    const withdrawal = await addEntry(aliceId, jar.id, {
      kind: "WITHDRAW",
      amount: 400_000,
      occurredOn: "2026-11-02",
    });

    await rejectsWith(deleteEntry(aliceId, jar.id, deposit.id), ConflictError);
    await deleteEntry(aliceId, jar.id, withdrawal.id);
    await deleteEntry(aliceId, jar.id, deposit.id);
    await expect(getJar(aliceId, jar.id)).resolves.toMatchObject({ balance: 0, entries: [] });
  });
});

describe("another user's jar", () => {
  it("is a 404 for every operation and stays untouched", async () => {
    const jar = await createJar(bobId, { name: "Của Bob" });
    const entry = await addEntry(bobId, jar.id, {
      kind: "DEPOSIT",
      amount: 9_000,
      occurredOn: "2026-11-01",
    });

    await rejectsWith(getJar(aliceId, jar.id), NotFoundError);
    await rejectsWith(updateJar(aliceId, jar.id, { name: "Hacked" }), NotFoundError);
    await rejectsWith(
      addEntry(aliceId, jar.id, { kind: "WITHDRAW", amount: 9_000, occurredOn: "2026-11-02" }),
      NotFoundError,
    );
    await rejectsWith(deleteEntry(aliceId, jar.id, entry.id), NotFoundError);
    await rejectsWith(deleteJar(aliceId, jar.id), NotFoundError);
    expect((await listJars(aliceId)).jars).toEqual([]);

    await expect(getJar(bobId, jar.id)).resolves.toMatchObject({ name: "Của Bob", balance: 9_000 });
  });
});
