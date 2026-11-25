// Relative imports with extensions only: prisma/seed.ts runs this file with
// plain `node`, which knows neither the "@/" alias nor extensionless paths.
import type { DebtDirection, PrismaClient, TransactionType } from "@prisma/client";

import { addDays, addMonths, startOfZonedDay, toDateKey } from "../../lib/dates.ts";
import { hashPassword } from "../auth/password.ts";
import { DEFAULT_CATEGORIES } from "../categories/defaults.ts";

/**
 * Public demo login, shown in the README. Reset daily by the cron when enabled.
 * example.com is reserved (RFC 2606): nobody receives its mail, so nobody can
 * take the account over through "Quên mật khẩu".
 */
export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo-luckymoney";
export const DEMO_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type DemoTransaction = {
  type: TransactionType;
  category: string;
  amount: number;
  dateKey: string;
  /** Local hour and minute of the day, in DEMO_TIME_ZONE. */
  minuteOfDay: number;
  note: string;
};
export type DemoBudget = { category: string; month: string; amount: number };
export type DemoDebt = {
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  startDate: string;
  note: string;
  installments: { dueDate: string; amount: number }[];
  payments: { paidOn: string; amount: number; note: string }[];
};
export type DemoJar = {
  name: string;
  icon: string;
  entries: { kind: "DEPOSIT" | "WITHDRAW"; amount: number; occurredOn: string; note: string }[];
};
export type DemoData = {
  transactions: DemoTransaction[];
  budgets: DemoBudget[];
  debts: DemoDebt[];
  jars: DemoJar[];
};

/** Small deterministic PRNG (mulberry32): the same day always gives the same data. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS_OF_HISTORY = 6;

/**
 * Six months of everyday spending up to `today` ("YYYY-MM-DD"), plus this
 * month's budgets, three debts (one overdue, one in progress, one paid off)
 * and two savings jars. Pure, so it can be tested without a database.
 */
export function buildDemoData(today: string): DemoData {
  const next = random(20261125);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  /** A random amount between min and max, rounded to `step` VND. */
  const amount = (min: number, max: number, step = 1_000): number =>
    Math.round((min + next() * (max - min)) / step) * step;

  const transactions: DemoTransaction[] = [];
  const add = (
    type: TransactionType,
    category: string,
    value: number,
    dateKey: string,
    hour: number,
    note: string,
  ) => {
    const minuteOfDay = hour * 60 + Math.floor(next() * 50);
    transactions.push({ type, category, amount: value, dateKey, minuteOfDay, note });
  };

  const thisMonth = today.slice(0, 7);
  const firstMonth = addMonths(thisMonth, -(MONTHS_OF_HISTORY - 1));
  for (let day = `${firstMonth}-01`; day <= today; day = addDays(day, 1)) {
    const dayOfMonth = Number(day.slice(8));
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    const weekend = weekday === 0 || weekday === 6;
    const monthIndex = (Number(day.slice(5, 7)) + Number(day.slice(0, 4)) * 12) % 12;

    if (dayOfMonth === 1) add("EXPENSE", "Nhà ở", 4_500_000, day, 9, "Tiền thuê nhà");
    if (dayOfMonth === 3) add("EXPENSE", "Nhà ở", amount(550_000, 850_000), day, 20, "Điện nước");
    if (dayOfMonth === 5) add("INCOME", "Lương", 18_000_000, day, 10, "Lương tháng");
    if (dayOfMonth === 15) add("EXPENSE", "Học tập", 600_000, day, 21, "Khóa học tiếng Anh online");
    if (dayOfMonth === 20 && monthIndex % 3 === 0) {
      add("INCOME", "Thưởng", 3_000_000, day, 16, "Thưởng hoàn thành dự án");
    }
    if (dayOfMonth === 25 && monthIndex % 2 === 1) {
      add("INCOME", "Khác", amount(300_000, 900_000, 50_000), day, 18, "Bán đồ cũ");
    }

    add(
      "EXPENSE",
      "Ăn uống",
      amount(25_000, 45_000, 5_000),
      day,
      7,
      pick(["Bánh mì", "Phở", "Xôi"]),
    );
    add(
      "EXPENSE",
      "Ăn uống",
      amount(40_000, 75_000, 5_000),
      day,
      12,
      pick(["Cơm trưa", "Bún chả", "Cơm tấm"]),
    );
    if (next() < 0.55) {
      add(
        "EXPENSE",
        "Ăn uống",
        amount(30_000, 60_000, 5_000),
        day,
        15,
        pick(["Cà phê", "Trà sữa"]),
      );
    }
    if (weekend && next() < 0.6) {
      add(
        "EXPENSE",
        "Ăn uống",
        amount(250_000, 550_000, 10_000),
        day,
        19,
        pick(["Lẩu với bạn", "Ăn tối cùng gia đình"]),
      );
    }
    if (!weekend && next() < 0.6) {
      add("EXPENSE", "Đi lại", amount(18_000, 55_000), day, 8, "Grab đi làm");
    }
    if (weekday === 1) add("EXPENSE", "Đi lại", amount(70_000, 90_000), day, 18, "Đổ xăng");
    if (weekend && next() < 0.45) {
      add(
        "EXPENSE",
        "Giải trí",
        amount(90_000, 350_000, 10_000),
        day,
        20,
        pick(["Xem phim", "Karaoke", "Bida"]),
      );
    }
    if (next() < 0.09) {
      add(
        "EXPENSE",
        "Mua sắm",
        amount(150_000, 1_200_000, 10_000),
        day,
        21,
        pick(["Quần áo", "Đồ gia dụng", "Shopee"]),
      );
    }
    if (next() < 0.03) {
      add(
        "EXPENSE",
        "Sức khỏe",
        amount(80_000, 450_000, 10_000),
        day,
        17,
        pick(["Thuốc cảm", "Khám răng"]),
      );
    }
    if (next() < 0.04) {
      add(
        "EXPENSE",
        "Khác",
        amount(50_000, 200_000, 10_000),
        day,
        13,
        pick(["Quà sinh nhật", "Cắt tóc"]),
      );
    }
  }

  const budgets: DemoBudget[] = [
    { category: "Ăn uống", month: thisMonth, amount: 3_500_000 },
    { category: "Đi lại", month: thisMonth, amount: 900_000 },
    { category: "Giải trí", month: thisMonth, amount: 800_000 },
    { category: "Mua sắm", month: thisMonth, amount: 1_500_000 },
  ];

  const lanStart = addDays(today, -75);
  const debts: DemoDebt[] = [
    {
      direction: "I_OWE",
      counterparty: "Chị Lan",
      principal: 6_000_000,
      startDate: lanStart,
      note: "Mượn mua laptop, trả góp 3 tháng",
      installments: [30, 60, 90].map((offset) => ({
        dueDate: addDays(lanStart, offset),
        amount: 2_000_000,
      })),
      payments: [{ paidOn: addDays(lanStart, 29), amount: 2_000_000, note: "Kỳ 1" }],
    },
    {
      direction: "THEY_OWE",
      counterparty: "Minh (bạn đại học)",
      principal: 1_500_000,
      startDate: addDays(today, -20),
      note: "Cho mượn tiền vé tàu",
      installments: [{ dueDate: addDays(today, 10), amount: 1_500_000 }],
      payments: [{ paidOn: addDays(today, -5), amount: 500_000, note: "Trả trước một phần" }],
    },
    {
      direction: "I_OWE",
      counterparty: "Bố mẹ",
      principal: 10_000_000,
      startDate: addDays(today, -200),
      note: "Tiền cọc nhà",
      installments: [{ dueDate: addDays(today, -100), amount: 10_000_000 }],
      payments: [{ paidOn: addDays(today, -104), amount: 10_000_000, note: "Tất toán" }],
    },
  ];

  const monthDay = (offset: number, day: string): string =>
    `${addMonths(thisMonth, offset)}-${day}`;
  const jars: DemoJar[] = [
    {
      name: "Quỹ khẩn cấp",
      icon: "🛟",
      entries: Array.from({ length: MONTHS_OF_HISTORY }, (_, i) => ({
        kind: "DEPOSIT" as const,
        amount: 2_000_000,
        occurredOn: monthDay(i - (MONTHS_OF_HISTORY - 1), "06"),
        note: "Góp hằng tháng",
      })).filter((entry) => entry.occurredOn <= today),
    },
    {
      name: "Du lịch Đà Lạt",
      icon: "✈️",
      entries: [
        { kind: "DEPOSIT" as const, amount: 1_000_000, occurredOn: monthDay(-4, "07"), note: "" },
        { kind: "DEPOSIT" as const, amount: 1_000_000, occurredOn: monthDay(-3, "07"), note: "" },
        {
          kind: "WITHDRAW" as const,
          amount: 1_500_000,
          occurredOn: monthDay(-2, "12"),
          note: "Đặt cọc homestay",
        },
        { kind: "DEPOSIT" as const, amount: 1_500_000, occurredOn: monthDay(-1, "07"), note: "" },
      ],
    },
  ];

  return { transactions, budgets, debts, jars };
}

/**
 * Deletes the demo user and everything it owns, then creates it again with
 * fresh data relative to `now`. Visitors share this account, so it is reset
 * rather than updated.
 */
export async function resetDemoAccount(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<void> {
  const today = toDateKey(now, DEMO_TIME_ZONE);
  const data = buildDemoData(today);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.$transaction(
    async (tx) => {
      // Transactions first: their category link is ON DELETE RESTRICT.
      await tx.transaction.deleteMany({ where: { user: { email: DEMO_EMAIL } } });
      await tx.user.deleteMany({ where: { email: DEMO_EMAIL } });

      const user = await tx.user.create({
        data: { email: DEMO_EMAIL, name: "Tài khoản demo", passwordHash, timeZone: DEMO_TIME_ZONE },
        select: { id: true },
      });
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId: user.id })),
      });
      const categories = await tx.category.findMany({ where: { userId: user.id } });
      const categoryId = (type: TransactionType, name: string): string => {
        const found = categories.find((c) => c.type === type && c.name === name);
        if (!found) throw new Error(`Demo category missing: ${type} ${name}`);
        return found.id;
      };

      await tx.transaction.createMany({
        data: data.transactions
          .map((item) => ({
            userId: user.id,
            categoryId: categoryId(item.type, item.category),
            type: item.type,
            amount: item.amount,
            note: item.note,
            occurredAt: new Date(
              startOfZonedDay(item.dateKey, DEMO_TIME_ZONE).getTime() + item.minuteOfDay * 60_000,
            ),
          }))
          // Today's later entries have not happened yet.
          .filter((item) => item.occurredAt <= now),
      });
      await tx.budget.createMany({
        data: data.budgets.map((budget) => ({
          userId: user.id,
          categoryId: categoryId("EXPENSE", budget.category),
          month: budget.month,
          amount: budget.amount,
        })),
      });
      for (const debt of data.debts) {
        const { installments, payments, ...fields } = debt;
        await tx.debt.create({
          data: {
            ...fields,
            userId: user.id,
            installments: { create: installments },
            payments: { create: payments },
          },
        });
      }
      for (const jar of data.jars) {
        await tx.savingsJar.create({
          data: {
            userId: user.id,
            name: jar.name,
            icon: jar.icon,
            entries: {
              create: jar.entries.map((entry) => ({ ...entry, note: entry.note || null })),
            },
          },
        });
      }
    },
    // A hosted database far away can take more than the 2s default to hand out a connection.
    { maxWait: 15_000, timeout: 60_000 },
  );
}
