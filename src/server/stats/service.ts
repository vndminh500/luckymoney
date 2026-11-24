import type { TransactionType } from "@prisma/client";
import type { z } from "zod";

import {
  addDays,
  addMonths,
  getDayRange,
  getMonthRange,
  startOfWeekKey,
  toDateKey,
  toMonthKey,
  type WeekStart,
} from "@/lib/dates";
import {
  periodStatsQuerySchema,
  statsByCategoryQuerySchema,
  statsQuerySchema,
  type StatsPeriod,
} from "@/lib/schemas/stats";
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
  // Every category with transactions is visible: one that still has them cannot be deleted.
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

/** Income and expense of one bucket: a day ("YYYY-MM-DD") or, for a year, a month ("YYYY-MM"). */
export type PeriodBucket = { key: string; income: number; expense: number };

export type PeriodStats = {
  period: StatsPeriod;
  /** First day of the period ("YYYY-MM-DD"). */
  start: string;
  /** A date inside the previous and the next period, for navigation. */
  previous: string;
  next: string;
  totals: { income: number; expense: number; balance: number };
  buckets: PeriodBucket[];
};

/** Calendar layout of a period: its first day, its buckets and the UTC range to query. */
function periodLayout(
  period: StatsPeriod,
  dateKey: string,
  timeZone: string,
  weekStart: WeekStart,
) {
  if (period === "week") {
    const start = startOfWeekKey(dateKey, weekStart);
    const keys = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return {
      start,
      keys,
      range: getDayRange(start, 7, timeZone),
      bucketOf: (date: Date) => toDateKey(date, timeZone),
      previous: addDays(start, -7),
      next: addDays(start, 7),
    };
  }
  if (period === "month") {
    const month = dateKey.slice(0, 7);
    const start = `${month}-01`;
    const keys = Array.from({ length: daysInMonth(month) }, (_, index) => addDays(start, index));
    return {
      start,
      keys,
      range: getMonthRange(month, timeZone),
      bucketOf: (date: Date) => toDateKey(date, timeZone),
      previous: `${addMonths(month, -1)}-01`,
      next: `${addMonths(month, 1)}-01`,
    };
  }
  const year = Number(dateKey.slice(0, 4));
  const keys = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
  return {
    start: `${year}-01-01`,
    keys,
    range: {
      start: getMonthRange(`${year}-01`, timeZone).start,
      end: getMonthRange(`${year + 1}-01`, timeZone).start,
    },
    bucketOf: (date: Date) => toMonthKey(date, timeZone),
    previous: `${year - 1}-01-01`,
    next: `${year + 1}-01-01`,
  };
}

/**
 * GET /api/stats/period: income and expense of a week (from the user's first day
 * of the week, one bucket per day), a month (one per day) or a year (one per month), in the
 * user's time zone. Soft-deleted transactions never count.
 */
export async function getPeriodStats(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<PeriodStats> {
  const { period, date } = parse(periodStatsQuerySchema, query);
  const { timeZone, weekStart } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeZone: true, weekStart: true },
  });
  const layout = periodLayout(period, date ?? toDateKey(now, timeZone), timeZone, weekStart);

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: layout.range.start, lt: layout.range.end },
    },
    select: { type: true, amount: true, occurredAt: true },
  });

  const buckets: PeriodBucket[] = layout.keys.map((key) => ({ key, income: 0, expense: 0 }));
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const row of rows) {
    const bucket = byKey.get(layout.bucketOf(row.occurredAt));
    if (bucket) {
      bucket[row.type === "INCOME" ? "income" : "expense"] += row.amount;
    }
  }
  const income = buckets.reduce((total, bucket) => total + bucket.income, 0);
  const expense = buckets.reduce((total, bucket) => total + bucket.expense, 0);
  return {
    period,
    start: layout.start,
    previous: layout.previous,
    next: layout.next,
    totals: { income, expense, balance: income - expense },
    buckets,
  };
}
