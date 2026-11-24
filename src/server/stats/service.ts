import type { TransactionType } from "@prisma/client";
import type { z } from "zod";

import { getMonthRange, toDateKey, toMonthKey } from "@/lib/dates";
import { statsByCategoryQuerySchema, statsQuerySchema } from "@/lib/schemas/stats";
import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { getUserTimeZone } from "@/server/transactions/service";

/**
 * Monthly statistics. A month is the calendar month in the user's time zone,
 * soft-deleted transactions never count, and every query is scoped to userId.
 */

export type Summary = { month: string; income: number; expense: number; balance: number };

export type CategoryTotal = {
  categoryId: string;
  name: string;
  icon: string | null;
  total: number;
  /** Share of the month's total for this type, rounded to one decimal. */
  percent: number;
};

export type StatsByCategory = { month: string; type: TransactionType; items: CategoryTotal[] };

export type DailyTotal = { date: string; income: number; expense: number };

export type DailyStats = { month: string; days: DailyTotal[] };

function parse<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return parsed.data;
}

/** The month to report, its UTC range and the filter shared by every statistic. */
async function monthScope(userId: string, month: string | undefined, now: Date) {
  const timeZone = await getUserTimeZone(userId);
  const monthKey = month ?? toMonthKey(now, timeZone);
  const { start, end } = getMonthRange(monthKey, timeZone);
  const where = { userId, deletedAt: null, occurredAt: { gte: start, lt: end } };
  return { month: monthKey, timeZone, where };
}

/** GET /api/stats/summary: income, expense and balance of a month. */
export async function getSummary(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<Summary> {
  const { month } = parse(statsQuerySchema, query);
  const scope = await monthScope(userId, month, now);
  const groups = await prisma.transaction.groupBy({
    by: ["type"],
    where: scope.where,
    _sum: { amount: true },
  });
  const totalOf = (type: TransactionType) =>
    groups.find((group) => group.type === type)?._sum.amount ?? 0;
  const income = totalOf("INCOME");
  const expense = totalOf("EXPENSE");
  return { month: scope.month, income, expense, balance: income - expense };
}

/** Percentage with one decimal, computed on integers (no float sums of money). */
function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part * 1000) / whole) / 10;
}

/** GET /api/stats/by-category: totals per category for one type, largest first. */
export async function getStatsByCategory(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<StatsByCategory> {
  const { month, type } = parse(statsByCategoryQuerySchema, query);
  const scope = await monthScope(userId, month, now);
  const groups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { ...scope.where, type },
    _sum: { amount: true },
  });
  // Archived categories are included: old transactions still belong to them.
  const categories = await prisma.category.findMany({
    where: { userId, id: { in: groups.map((group) => group.categoryId) } },
    select: { id: true, name: true, icon: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  const grandTotal = groups.reduce((sum, group) => sum + (group._sum.amount ?? 0), 0);

  const items = groups
    .map((group) => {
      const category = byId.get(group.categoryId);
      const total = group._sum.amount ?? 0;
      return {
        categoryId: group.categoryId,
        name: category?.name ?? "",
        icon: category?.icon ?? null,
        total,
        percent: percentOf(total, grandTotal),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
  return { month: scope.month, type, items };
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/**
 * GET /api/stats/daily: income and expense per local day, every day of the
 * month included (zero when empty) so charts have a continuous axis.
 * Grouping by local day uses the same time zone rules as the month range.
 */
export async function getDailyStats(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<DailyStats> {
  const { month } = parse(statsQuerySchema, query);
  const scope = await monthScope(userId, month, now);
  const rows = await prisma.transaction.findMany({
    where: scope.where,
    select: { type: true, amount: true, occurredAt: true },
  });

  const days: DailyTotal[] = Array.from({ length: daysInMonth(scope.month) }, (_, index) => ({
    date: `${scope.month}-${String(index + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
  }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const row of rows) {
    const day = byDate.get(toDateKey(row.occurredAt, scope.timeZone));
    if (day) {
      day[row.type === "INCOME" ? "income" : "expense"] += row.amount;
    }
  }
  return { month: scope.month, days };
}
