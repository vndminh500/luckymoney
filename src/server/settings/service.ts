import type { AmountFormat, DateFormat, ThemePreference, WeekStart } from "@prisma/client";

import type { z } from "zod";

import type { BudgetStatus } from "@/lib/budget";
import {
  displayPreferencesSchema,
  notificationPreferencesSchema,
  themeSchema,
} from "@/lib/schemas/settings";
import { listBudgets } from "@/server/budgets/service";
import { prisma } from "@/server/db";
import { ValidationError } from "@/server/errors";

export type Preferences = {
  amountFormat: AmountFormat;
  dateFormat: DateFormat;
  weekStart: WeekStart;
  timeZone: string;
  theme: ThemePreference;
  notifyBudgetWarning: boolean;
  notifyBudgetOver: boolean;
  notifyDebtEmail: boolean;
};

/** What the UI needs to format amounts and dates the way the user chose. */
export type DisplayPreferences = Pick<Preferences, "amountFormat" | "dateFormat">;

const preferencesSelect = {
  amountFormat: true,
  dateFormat: true,
  weekStart: true,
  timeZone: true,
  theme: true,
  notifyBudgetWarning: true,
  notifyBudgetOver: true,
  notifyDebtEmail: true,
} as const;

export async function getPreferences(userId: string): Promise<Preferences> {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: preferencesSelect });
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return parsed.data;
}

/** Cài đặt > Tùy chỉnh tài chính: amount and date format, week start, time zone. */
export async function updateDisplayPreferences(userId: string, input: unknown): Promise<void> {
  const data = parse(displayPreferencesSchema, input);
  await prisma.user.update({ where: { id: userId }, data });
}

/** Cài đặt > Giao diện. */
export async function updateTheme(userId: string, theme: unknown): Promise<void> {
  const data = parse(themeSchema, { theme });
  await prisma.user.update({ where: { id: userId }, data });
}

/** Cài đặt > Thông báo. */
export async function updateNotificationPreferences(userId: string, input: unknown): Promise<void> {
  const data = parse(notificationPreferencesSchema, input);
  await prisma.user.update({ where: { id: userId }, data });
}

export type BudgetAlert = {
  budgetId: string;
  name: string;
  icon: string | null;
  percentUsed: number;
  status: Exclude<BudgetStatus, "ok">;
};

/**
 * Budgets of a month that need attention, as the user asked to be told:
 * at 80% (warning) and/or over 100% (over). Most urgent first.
 */
export async function getBudgetAlerts(userId: string, month: string): Promise<BudgetAlert[]> {
  const [{ notifyBudgetWarning, notifyBudgetOver }, { items }] = await Promise.all([
    getPreferences(userId),
    listBudgets(userId, { month }),
  ]);
  const alerts: BudgetAlert[] = [];
  for (const item of items) {
    const wanted =
      (item.status === "warning" && notifyBudgetWarning) ||
      (item.status === "over" && notifyBudgetOver);
    if (wanted && item.status !== "ok") {
      alerts.push({
        budgetId: item.id,
        name: item.name,
        icon: item.icon,
        percentUsed: item.percentUsed,
        status: item.status,
      });
    }
  }
  return alerts.sort((a, b) => b.percentUsed - a.percentUsed);
}
