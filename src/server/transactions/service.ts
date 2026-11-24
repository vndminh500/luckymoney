import { Prisma, type TransactionType } from "@prisma/client";

import { getMonthRange, startOfZonedDay, toDateKey, toMonthKey } from "@/lib/dates";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionFormSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/lib/schemas/transaction";
import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";

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
 * The category must be the user's own (not deleted) and of the same type.
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
  const timeZone = await getUserTimeZone(userId);
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
 * Unknown, another user's, deleted and wrong-type categories all fail the same
 * way, so the error never reveals whether someone else's category exists.
 */
async function assertSelectableCategory(
  userId: string,
  categoryId: string,
  type: TransactionType,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, deletedAt: null, type },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError([{ field: "categoryId", message: "Danh mục không hợp lệ." }]);
  }
}

/** The user's IANA time zone, used to turn instants into their local days and months. */
export async function getUserTimeZone(userId: string): Promise<string> {
  const { timeZone } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeZone: true },
  });
  return timeZone;
}

/** Today's date ("YYYY-MM-DD") in the user's time zone, the default for the form. */
export async function getTodayKeyForUser(userId: string, now = new Date()): Promise<string> {
  const timeZone = await getUserTimeZone(userId);
  return toDateKey(now, timeZone);
}

/** A transaction in the list, with its category. */
export type TransactionListItem = {
  id: string;
  type: TransactionType;
  amount: number;
  occurredAt: Date;
  note: string | null;
  category: { id: string; name: string; icon: string | null };
};

export type TransactionPage = {
  /** The month that was listed ("YYYY-MM"), resolved when the query had none. */
  month: string;
  /** The user's time zone, for showing each transaction's local date. */
  timeZone: string;
  items: TransactionListItem[];
  page: number;
  pageSize: number;
  total: number;
};

/**
 * One page of the user's transactions in a month of their time zone, newest
 * first. Soft-deleted rows are skipped. `query` comes straight from the URL.
 */
export async function listTransactions(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<TransactionPage> {
  const parsed = listTransactionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { categoryId, type, page, pageSize } = parsed.data;
  const timeZone = await getUserTimeZone(userId);
  const month = parsed.data.month ?? toMonthKey(now, timeZone);
  const { start, end } = getMonthRange(month, timeZone);

  const where = {
    userId,
    deletedAt: null,
    occurredAt: { gte: start, lt: end },
    ...(categoryId ? { categoryId } : {}),
    ...(type ? { type } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      // id breaks ties so pages never overlap or skip rows with the same time.
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listItemSelect,
    }),
    prisma.transaction.count({ where }),
  ]);

  const items = rows.map(toListItem);
  return { month, timeZone, items, page, pageSize, total };
}

const listItemSelect = {
  id: true,
  type: true,
  amount: true,
  occurredAt: true,
  note: true,
  category: { select: { id: true, name: true, icon: true } },
} as const;

type ListItemRow = Prisma.TransactionGetPayload<{ select: typeof listItemSelect }>;

function toListItem(row: ListItemRow): TransactionListItem {
  return row;
}

/** Only the user's own, not soft-deleted transaction; anything else is "not found". */
const ownedActive = (userId: string, id: string) => ({ id, userId, deletedAt: null });

const transactionNotFound = () => new NotFoundError("Không tìm thấy giao dịch.");

/** One of the user's transactions. Another user's or a deleted one is a 404. */
export async function getTransaction(userId: string, id: string): Promise<TransactionListItem> {
  const row = await prisma.transaction.findFirst({
    where: ownedActive(userId, id),
    select: listItemSelect,
  });
  if (!row) {
    throw transactionNotFound();
  }
  return toListItem(row);
}

/** PATCH: changes only the given fields. A new type or category must be selectable. */
export async function updateTransaction(
  userId: string,
  id: string,
  input: unknown,
): Promise<TransactionDto> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return applyUpdate(userId, id, parsed.data);
}

/**
 * Saves the edit form. If the day did not change, the original time is kept,
 * so editing the amount never moves a transaction within its day.
 */
export async function updateTransactionFromForm(
  userId: string,
  id: string,
  input: unknown,
): Promise<TransactionDto> {
  const parsed = transactionFormSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { date, ...rest } = parsed.data;
  const existing = await findOwnedActive(userId, id);
  const timeZone = await getUserTimeZone(userId);
  const occurredAt =
    toDateKey(existing.occurredAt, timeZone) === date
      ? existing.occurredAt
      : startOfZonedDay(date, timeZone);
  return applyUpdate(userId, id, { ...rest, occurredAt });
}

async function findOwnedActive(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({
    where: ownedActive(userId, id),
    select: { type: true, categoryId: true, occurredAt: true },
  });
  if (!existing) {
    throw transactionNotFound();
  }
  return existing;
}

async function applyUpdate(
  userId: string,
  id: string,
  data: UpdateTransactionInput,
): Promise<TransactionDto> {
  const existing = await findOwnedActive(userId, id);
  const type = data.type ?? existing.type;
  const categoryId = data.categoryId ?? existing.categoryId;
  // The current category is valid by construction: a category with transactions cannot be deleted.
  if (type !== existing.type || categoryId !== existing.categoryId) {
    await assertSelectableCategory(userId, categoryId, type);
  }
  try {
    return await prisma.transaction.update({
      where: ownedActive(userId, id),
      data,
      select: transactionSelect,
    });
  } catch (error) {
    // Deleted between the check and the update.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw transactionNotFound();
    }
    throw error;
  }
}

/** Soft delete: sets deletedAt. Another user's, unknown or already deleted is a 404. */
export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const { count } = await prisma.transaction.updateMany({
    where: ownedActive(userId, id),
    data: { deletedAt: new Date() },
  });
  if (count === 0) {
    throw transactionNotFound();
  }
}
