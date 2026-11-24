import { Prisma, type SavingsEntryKind } from "@prisma/client";
import type { z } from "zod";

import { createJarSchema, entrySchema, updateJarSchema } from "@/lib/schemas/savings";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

/**
 * Tích góp: savings jars. Every query is scoped to the user through
 * SavingsJar.userId; entries are only reached through a jar the user owns.
 * The balance is derived from the entries and never goes below zero.
 */

export type JarSummary = {
  id: string;
  name: string;
  icon: string | null;
  balance: number;
  /** Day of the latest deposit or withdrawal, null for a new jar. */
  lastActivity: string | null;
};

export type SavingsEntryDto = {
  id: string;
  kind: SavingsEntryKind;
  amount: number;
  occurredOn: string;
  note: string | null;
  /** Balance right after this entry, in history order. */
  balanceAfter: number;
};

export type JarDetail = JarSummary & {
  deposited: number;
  withdrawn: number;
  /** Newest first. */
  entries: SavingsEntryDto[];
};

type EntryRow = {
  id: string;
  kind: SavingsEntryKind;
  amount: number;
  occurredOn: string;
  note: string | null;
  createdAt: Date;
};

const jarNotFound = () => new NotFoundError("Không tìm thấy hũ tích góp.");
const duplicateName = () => new ConflictError("Đã có hũ cùng tên.");

const signed = (entry: Pick<EntryRow, "kind" | "amount">) =>
  entry.kind === "DEPOSIT" ? entry.amount : -entry.amount;

/** Oldest first: by day, then by when it was recorded. */
const chronological = (a: EntryRow, b: EntryRow) =>
  a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.getTime() - b.createdAt.getTime();

function parse<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}

const entrySelect = {
  id: true,
  kind: true,
  amount: true,
  occurredOn: true,
  note: true,
  createdAt: true,
} as const;

async function findOwned(userId: string, id: string) {
  const jar = await prisma.savingsJar.findFirst({
    where: { id, userId },
    select: { id: true, name: true, icon: true, entries: { select: entrySelect } },
  });
  if (!jar) {
    throw jarNotFound();
  }
  return jar;
}

function toDetail(jar: { id: string; name: string; icon: string | null; entries: EntryRow[] }) {
  const ordered = [...jar.entries].sort(chronological);
  let balance = 0;
  let deposited = 0;
  let withdrawn = 0;
  const entries = ordered.map((entry): SavingsEntryDto => {
    balance += signed(entry);
    if (entry.kind === "DEPOSIT") deposited += entry.amount;
    else withdrawn += entry.amount;
    return {
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
      occurredOn: entry.occurredOn,
      note: entry.note,
      balanceAfter: balance,
    };
  });
  return {
    id: jar.id,
    name: jar.name,
    icon: jar.icon,
    balance,
    deposited,
    withdrawn,
    lastActivity: ordered.at(-1)?.occurredOn ?? null,
    entries: entries.reverse(),
  } satisfies JarDetail;
}

async function withUniqueName<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw duplicateName();
    }
    throw error;
  }
}

/** The user's jars, largest balance first, and the total over all of them. */
export async function listJars(userId: string): Promise<{ jars: JarSummary[]; total: number }> {
  const rows = await prisma.savingsJar.findMany({
    where: { userId },
    select: { id: true, name: true, icon: true, entries: { select: entrySelect } },
  });
  const jars = rows
    .map((row) => {
      const { id, name, icon, balance, lastActivity } = toDetail(row);
      return { id, name, icon, balance, lastActivity };
    })
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "vi"));
  return { jars, total: jars.reduce((sum, jar) => sum + jar.balance, 0) };
}

export async function getJar(userId: string, id: string): Promise<JarDetail> {
  return toDetail(await findOwned(userId, id));
}

export async function createJar(userId: string, input: unknown): Promise<JarSummary> {
  const data = parse(createJarSchema.safeParse(input));
  const jar = await withUniqueName(() =>
    prisma.savingsJar.create({
      data: { ...data, userId },
      select: { id: true, name: true, icon: true },
    }),
  );
  return { ...jar, balance: 0, lastActivity: null };
}

export async function updateJar(userId: string, id: string, input: unknown): Promise<void> {
  await findOwned(userId, id);
  const data = parse(updateJarSchema.safeParse(input));
  await withUniqueName(() => prisma.savingsJar.update({ where: { id, userId }, data }));
}

export async function deleteJar(userId: string, id: string): Promise<void> {
  const { count } = await prisma.savingsJar.deleteMany({ where: { id, userId } });
  if (count === 0) {
    throw jarNotFound();
  }
}

/** Deposits or withdraws; a withdrawal never takes more than the balance. */
export async function addEntry(
  userId: string,
  jarId: string,
  input: unknown,
): Promise<SavingsEntryDto> {
  const jar = await findOwned(userId, jarId);
  const data = parse(entrySchema.safeParse(input));
  const balance = jar.entries.reduce((sum, entry) => sum + signed(entry), 0);
  if (data.kind === "WITHDRAW" && data.amount > balance) {
    throw new ValidationError([{ field: "amount", message: "Số tiền rút lớn hơn số dư của hũ." }]);
  }
  const entry = await prisma.savingsEntry.create({
    data: { ...data, jarId },
    select: entrySelect,
  });
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount,
    occurredOn: entry.occurredOn,
    note: entry.note,
    balanceAfter: balance + signed(entry),
  };
}

/** Undoes an entry, unless removing a deposit would leave the jar below zero. */
export async function deleteEntry(userId: string, jarId: string, entryId: string): Promise<void> {
  const jar = await findOwned(userId, jarId);
  const entry = jar.entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new NotFoundError("Không tìm thấy lần nạp/rút.");
  }
  const balance = jar.entries.reduce((sum, item) => sum + signed(item), 0);
  if (balance - signed(entry) < 0) {
    throw new ConflictError(
      "Không hoàn tác được: tiền của lần nạp này đã được rút ra. Hãy hoàn tác lần rút trước.",
    );
  }
  await prisma.savingsEntry.deleteMany({ where: { id: entryId, jarId, jar: { userId } } });
}
