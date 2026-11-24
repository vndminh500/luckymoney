import { beforeEach, describe, expect, it } from "vitest";

import { registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";
import {
  addPayment,
  createDebt,
  deleteDebt,
  deletePayment,
  getDebt,
  listDebts,
  settleDebt,
  updateDebt,
} from "@/server/debts/service";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

let aliceId: string;
let bobId: string;
const TODAY = "2026-11-24";

const loan = {
  direction: "I_OWE",
  counterparty: "Anh Hùng",
  principal: 3_000_000,
  startDate: "2026-09-20",
  note: "Mượn sửa xe",
  installments: [
    { dueDate: "2026-10-05", amount: 1_000_000 },
    { dueDate: "2026-11-05", amount: 1_000_000 },
    { dueDate: "2026-12-05", amount: 1_000_000 },
  ],
};

async function fields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

async function notFound(promise: Promise<unknown>): Promise<void> {
  await expect(promise.catch((e: unknown) => e)).resolves.toBeInstanceOf(NotFoundError);
}

beforeEach(async () => {
  aliceId = (await registerUser({ email: "alice@example.com", password: "mat-khau-an-toan" })).id;
  bobId = (await registerUser({ email: "bob@example.com", password: "mat-khau-an-toan" })).id;
});

describe("createDebt", () => {
  it("stores the debt with its schedule", async () => {
    const { id } = await createDebt(aliceId, loan);
    const debt = await getDebt(aliceId, id, TODAY);

    expect(debt).toMatchObject({
      id,
      direction: "I_OWE",
      counterparty: "Anh Hùng",
      note: "Mượn sửa xe",
      startDate: "2026-09-20",
      status: { principal: 3_000_000, paid: 0, remaining: 3_000_000, overdueCount: 2 },
      payments: [],
    });
    expect(debt.status.installments.map((i) => [i.dueDate, i.state])).toEqual([
      ["2026-10-05", "overdue"],
      ["2026-11-05", "overdue"],
      ["2026-12-05", "upcoming"],
    ]);
  });

  it("requires the installments to add up to the amount", async () => {
    await expect(
      fields(
        createDebt(aliceId, {
          ...loan,
          installments: [{ dueDate: "2026-10-05", amount: 1_000_000 }],
        }),
      ),
    ).resolves.toEqual(["installments"]);
  });

  it.each([
    ["counterparty", { counterparty: " " }],
    ["principal", { principal: 0 }],
    ["direction", { direction: "BOTH" }],
    ["startDate", { startDate: "2026-02-30" }],
    ["installments", { installments: [] }],
  ])("rejects an invalid %s", async (field, change) => {
    await expect(fields(createDebt(aliceId, { ...loan, ...change }))).resolves.toContain(field);
  });

  it("ignores a client userId", async () => {
    const { id } = await createDebt(aliceId, { ...loan, userId: bobId });
    const stored = await prisma.debt.findUniqueOrThrow({ where: { id } });
    expect(stored.userId).toBe(aliceId);
  });
});

describe("listDebts", () => {
  it("totals what I owe and what I am owed, without settled debts", async () => {
    await createDebt(aliceId, loan);
    const lent = await createDebt(aliceId, {
      ...loan,
      direction: "THEY_OWE",
      counterparty: "Lan",
      principal: 500_000,
      installments: [{ dueDate: "2026-12-01", amount: 500_000 }],
    });
    const settled = await createDebt(aliceId, {
      ...loan,
      direction: "THEY_OWE",
      counterparty: "Minh",
      principal: 200_000,
      installments: [{ dueDate: "2026-11-01", amount: 200_000 }],
    });
    await addPayment(aliceId, settled.id, { amount: 200_000, paidOn: "2026-11-02" });
    await addPayment(aliceId, lent.id, { amount: 100_000, paidOn: "2026-11-10" });
    await createDebt(bobId, loan);

    const { debts, totals } = await listDebts(aliceId, TODAY);

    expect(debts).toHaveLength(3);
    expect(totals).toEqual({ iOwe: 3_000_000, theyOwe: 400_000, overdueCount: 2 });
    // Open debts first (earliest next due date), settled ones last.
    expect(debts.map((debt) => debt.counterparty)).toEqual(["Anh Hùng", "Lan", "Minh"]);
  });
});

describe("payments", () => {
  it("records partial payments against the earliest installments", async () => {
    const { id } = await createDebt(aliceId, loan);
    await addPayment(aliceId, id, {
      amount: 1_500_000,
      paidOn: "2026-11-01",
      note: "Chuyển khoản",
    });

    const debt = await getDebt(aliceId, id, TODAY);
    expect(debt.status).toMatchObject({ paid: 1_500_000, remaining: 1_500_000, overdueCount: 1 });
    expect(debt.payments).toEqual([
      { id: expect.any(String), amount: 1_500_000, paidOn: "2026-11-01", note: "Chuyển khoản" },
    ]);
  });

  it("refuses to pay more than what is left", async () => {
    const { id } = await createDebt(aliceId, loan);
    await addPayment(aliceId, id, { amount: 2_500_000, paidOn: "2026-11-01" });
    await expect(
      fields(addPayment(aliceId, id, { amount: 600_000, paidOn: "2026-11-02" })),
    ).resolves.toEqual(["amount"]);
  });

  it("can undo a payment", async () => {
    const { id } = await createDebt(aliceId, loan);
    const payment = await addPayment(aliceId, id, { amount: 1_000_000, paidOn: "2026-11-01" });
    await deletePayment(aliceId, id, payment.id);
    await expect(getDebt(aliceId, id, TODAY)).resolves.toMatchObject({ status: { paid: 0 } });
  });
});

describe("updateDebt", () => {
  it("replaces the details and the schedule", async () => {
    const { id } = await createDebt(aliceId, loan);
    await updateDebt(aliceId, id, {
      ...loan,
      counterparty: "Anh Hùng (cơ quan)",
      principal: 2_000_000,
      installments: [{ dueDate: "2027-01-01", amount: 2_000_000 }],
    });
    const debt = await getDebt(aliceId, id, TODAY);
    expect(debt).toMatchObject({
      counterparty: "Anh Hùng (cơ quan)",
      status: { principal: 2_000_000, overdueCount: 0 },
    });
    expect(debt.status.installments).toHaveLength(1);
  });

  it("cannot lower the amount below what was already paid", async () => {
    const { id } = await createDebt(aliceId, loan);
    await addPayment(aliceId, id, { amount: 2_000_000, paidOn: "2026-11-01" });
    await expect(
      fields(
        updateDebt(aliceId, id, {
          ...loan,
          principal: 1_000_000,
          installments: [{ dueDate: "2026-12-01", amount: 1_000_000 }],
        }),
      ),
    ).resolves.toEqual(["principal"]);
  });
});

describe("another user's debt", () => {
  it("is a 404 for every operation and stays untouched", async () => {
    const { id } = await createDebt(bobId, loan);
    const payment = await addPayment(bobId, id, { amount: 1_000, paidOn: "2026-11-01" });

    await notFound(getDebt(aliceId, id, TODAY));
    await notFound(updateDebt(aliceId, id, loan));
    await notFound(addPayment(aliceId, id, { amount: 1_000, paidOn: "2026-11-01" }));
    await notFound(deletePayment(aliceId, id, payment.id));
    await notFound(deleteDebt(aliceId, id));
    expect((await listDebts(aliceId, TODAY)).debts).toEqual([]);

    const stored = await getDebt(bobId, id, TODAY);
    expect(stored).toMatchObject({ counterparty: "Anh Hùng", status: { paid: 1_000 } });
  });
});

describe("deleteDebt", () => {
  it("removes the debt with its schedule and payments", async () => {
    const { id } = await createDebt(aliceId, loan);
    await addPayment(aliceId, id, { amount: 1_000, paidOn: "2026-11-01" });
    await deleteDebt(aliceId, id);
    expect(await prisma.debt.count()).toBe(0);
    expect(await prisma.debtInstallment.count()).toBe(0);
    expect(await prisma.debtPayment.count()).toBe(0);
  });
});

describe("settleDebt", () => {
  it("pays off everything that is left in one payment dated today", async () => {
    const { id } = await createDebt(aliceId, loan);
    await addPayment(aliceId, id, { amount: 1_200_000, paidOn: "2026-10-05" });

    await settleDebt(aliceId, id, TODAY);

    const debt = await getDebt(aliceId, id, TODAY);
    expect(debt.status).toMatchObject({ remaining: 0, settled: true, overdueCount: 0 });
    expect(debt.payments[0]).toMatchObject({
      amount: 1_800_000,
      paidOn: TODAY,
      note: "Tất toán",
    });
  });

  it("refuses a debt that is already settled", async () => {
    const { id } = await createDebt(aliceId, loan);
    await settleDebt(aliceId, id, TODAY);
    const error = await settleDebt(aliceId, id, TODAY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((await getDebt(aliceId, id, TODAY)).payments).toHaveLength(1);
  });

  it("is a 404 on another user's debt, which stays untouched", async () => {
    const { id } = await createDebt(bobId, loan);
    await notFound(settleDebt(aliceId, id, TODAY));
    expect((await getDebt(bobId, id, TODAY)).payments).toEqual([]);
  });
});
