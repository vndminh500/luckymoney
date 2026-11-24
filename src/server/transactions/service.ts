import type { TransactionType } from "@prisma/client";

import { startOfZonedDay, toDateKey } from "@/lib/dates";
import {
  createTransactionSchema,
  transactionFormSchema,
  type CreateTransactionInput,
} from "@/lib/schemas/transaction";
import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";

/** A transaction as returned to clients (no userId, no deletedAt). */
export type TransactionDto = {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  occurredAt: Date;
  note: string | null;
  createdAt: Date;
};

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  categoryId: true,
  occurredAt: true,
  note: true,
  createdAt: true,
} as const;

/**
 * Creates a transaction for `userId` (always the session user, never client input).
 * The category must be the user's own, not archived, and of the same type.
 */
export async function createTransaction(userId: string, input: unknown): Promise<TransactionDto> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return insertTransaction(userId, parsed.data);
}

/**
 * Creates a transaction from the "add transaction" form: the amount is typed
 * text ("50k") and the date is a day in the user's time zone, stored as the
 * first instant of that day.
 */
export async function createTransactionFromForm(
  userId: string,
  input: unknown,
): Promise<TransactionDto> {
  const parsed = transactionFormSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { date, ...rest } = parsed.data;
  const { timeZone } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeZone: true },
  });
  return insertTransaction(userId, { ...rest, occurredAt: startOfZonedDay(date, timeZone) });
}

async function insertTransaction(
  userId: string,
  data: CreateTransactionInput,
): Promise<TransactionDto> {
  await assertSelectableCategory(userId, data.categoryId, data.type);
  return prisma.transaction.create({
    data: { ...data, userId },
    select: transactionSelect,
  });
}

/**
 * Unknown, another user's, archived and wrong-type categories all fail the same
 * way, so the error never reveals whether someone else's category exists.
 */
async function assertSelectableCategory(
  userId: string,
  categoryId: string,
  type: TransactionType,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, archivedAt: null, type },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError([
      { field: "categoryId", message: "Danh mục không hợp lệ hoặc đã được lưu trữ." },
    ]);
  }
}

/** Today's date ("YYYY-MM-DD") in the user's time zone, the default for the form. */
export async function getTodayKeyForUser(userId: string, now = new Date()): Promise<string> {
  const { timeZone } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeZone: true },
  });
  return toDateKey(now, timeZone);
}
