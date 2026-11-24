import type { DebtDirection, Prisma } from "@prisma/client";
import type { z } from "zod";

import { toDateKey } from "@/lib/dates";
import { scheduleStatus, type ScheduleStatus } from "@/lib/debt";
import { debtSchema, paymentSchema, type DebtInput } from "@/lib/schemas/debt";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

/**
 * Sổ nợ. Every query is scoped to the user through Debt.userId; installments
 * and payments are only reached through a debt the user owns. Debts are not
 * transactions and never change income, expense or statistics.
 */

export type DebtSummary = {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  startDate: string;
  note: string | null;
  status: ScheduleStatus;
};

export type DebtPaymentDto = { id: string; amount: number; paidOn: string; note: string | null };

export type DebtDetail = DebtSummary & { payments: DebtPaymentDto[] };

export type DebtTotals = {
  /** What is left to pay back, over open debts. */
  iOwe: number;
  /** What others still owe, over open debts. */
  theyOwe: number;
  overdueCount: number;
};

const debtNotFound = () => new NotFoundError("Không tìm thấy khoản nợ.");

const debtInclude = {
  installments: { select: { id: true, dueDate: true, amount: true } },
  payments: {
    select: { id: true, amount: true, paidOn: true, note: true },
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.DebtInclude;

type DebtRow = {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  startDate: string;
  note: string | null;
  installments: { id: string; dueDate: string; amount: number }[];
  payments: DebtPaymentDto[];
};

function toDetail(row: DebtRow, today: string): DebtDetail {
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    startDate: row.startDate,
    note: row.note,
    status: scheduleStatus(
      row.installments,
      row.payments.map((payment) => payment.amount),
      today,
    ),
    payments: row.payments,
  };
}

function parse<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}

async function findOwned(userId: string, id: string): Promise<DebtRow> {
  const row = await prisma.debt.findFirst({ where: { id, userId }, include: debtInclude });
  if (!row) {
    throw debtNotFound();
  }
  return row;
}

/** All of the user's debts (open first, by next due date) and the totals. */
export async function listDebts(
  userId: string,
  today: string,
): Promise<{ debts: DebtSummary[]; totals: DebtTotals }> {
  const rows = await prisma.debt.findMany({ where: { userId }, include: debtInclude });
  const debts = rows.map((row) => toDetail(row, today));
  debts.sort((a, b) => {
    if (a.status.settled !== b.status.settled) return a.status.settled ? 1 : -1;
    const aNext = a.status.nextDue?.dueDate ?? "9999";
    const bNext = b.status.nextDue?.dueDate ?? "9999";
    return aNext.localeCompare(bNext) || a.counterparty.localeCompare(b.counterparty, "vi");
  });
  const totals: DebtTotals = { iOwe: 0, theyOwe: 0, overdueCount: 0 };
  for (const debt of debts) {
    if (debt.direction === "I_OWE") totals.iOwe += debt.status.remaining;
    else totals.theyOwe += debt.status.remaining;
    totals.overdueCount += debt.status.overdueCount;
  }
  return {
    debts: debts.map(({ id, direction, counterparty, startDate, note, status }) => ({
      id,
      direction,
      counterparty,
      startDate,
      note,
      status,
    })),
    totals,
  };
}

export async function getDebt(userId: string, id: string, today: string): Promise<DebtDetail> {
  return toDetail(await findOwned(userId, id), today);
}

function writeData(data: DebtInput) {
  return {
    direction: data.direction,
    counterparty: data.counterparty,
    principal: data.principal,
    startDate: data.startDate,
    note: data.note,
  };
}

export async function createDebt(userId: string, input: unknown): Promise<{ id: string }> {
  const data = parse(debtSchema.safeParse(input));
  return prisma.debt.create({
    data: {
      ...writeData(data),
      userId,
      installments: { create: data.installments },
    },
    select: { id: true },
  });
}

/** Replaces the details and the schedule. The amount cannot drop below what was paid. */
export async function updateDebt(userId: string, id: string, input: unknown): Promise<void> {
  const existing = await findOwned(userId, id);
  const data = parse(debtSchema.safeParse(input));
  const paid = existing.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (data.principal < paid) {
    throw new ValidationError([
      { field: "principal", message: "Số tiền nợ không thể nhỏ hơn số đã trả." },
    ]);
  }
  await prisma.$transaction([
    prisma.debtInstallment.deleteMany({ where: { debtId: id, debt: { userId } } }),
    prisma.debt.update({
      where: { id, userId },
      data: { ...writeData(data), installments: { create: data.installments } },
    }),
  ]);
}

export async function deleteDebt(userId: string, id: string): Promise<void> {
  const { count } = await prisma.debt.deleteMany({ where: { id, userId } });
  if (count === 0) {
    throw debtNotFound();
  }
}

/** Records a (possibly partial) repayment; never more than what is left. */
export async function addPayment(
  userId: string,
  debtId: string,
  input: unknown,
): Promise<DebtPaymentDto> {
  const existing = await findOwned(userId, debtId);
  const data = parse(paymentSchema.safeParse(input));
  const principal = existing.installments.reduce((sum, item) => sum + item.amount, 0);
  const paid = existing.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (data.amount > principal - paid) {
    throw new ValidationError([{ field: "amount", message: "Số tiền trả lớn hơn số còn nợ." }]);
  }
  return prisma.debtPayment.create({
    data: { ...data, debtId },
    select: { id: true, amount: true, paidOn: true, note: true },
  });
}

export async function deletePayment(
  userId: string,
  debtId: string,
  paymentId: string,
): Promise<void> {
  const { count } = await prisma.debtPayment.deleteMany({
    where: { id: paymentId, debtId, debt: { userId } },
  });
  if (count === 0) {
    throw new NotFoundError("Không tìm thấy lần trả.");
  }
}

/** Today's calendar day in the user's time zone, which decides what is overdue. */
export async function todayForUser(userId: string, now: Date = new Date()): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeZone: true },
  });
  return toDateKey(now, user.timeZone);
}

export const SETTLE_NOTE = "Tất toán";

/**
 * "Đã tất toán": pays off everything that is left in one payment dated
 * `today`, so every installment becomes paid. Undo it like any payment.
 */
export async function settleDebt(userId: string, id: string, today: string): Promise<void> {
  const existing = await findOwned(userId, id);
  const principal = existing.installments.reduce((sum, item) => sum + item.amount, 0);
  const paid = existing.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = principal - paid;
  if (remaining <= 0) {
    throw new ConflictError("Khoản nợ này đã trả xong.");
  }
  await prisma.debtPayment.create({
    data: { debtId: id, amount: remaining, paidOn: today, note: SETTLE_NOTE },
  });
}
