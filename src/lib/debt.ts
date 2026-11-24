/**
 * Debt schedule math (pure, integer VND, calendar day keys "YYYY-MM-DD").
 */

export type PlannedInstallment = { dueDate: string; amount: number };

export type InstallmentState = "paid" | "partial" | "upcoming" | "overdue";

export type InstallmentStatus = {
  id: string;
  dueDate: string;
  amount: number;
  /** Part of this installment covered by payments, earliest installments first. */
  paid: number;
  state: InstallmentState;
};

export type ScheduleStatus = {
  installments: InstallmentStatus[];
  principal: number;
  paid: number;
  remaining: number;
  settled: boolean;
  overdueCount: number;
  /** The first installment not fully paid, with what is left on it. */
  nextDue: { id: string; dueDate: string; left: number } | null;
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Same day N months later, clamped to the month's last day (Jan 31 + 1 = Feb 28). */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

/** Equal monthly installments from the first due date; the remainder goes on the last. */
export function splitEvenly(
  principal: number,
  count: number,
  firstDueDate: string,
): PlannedInstallment[] {
  const base = Math.floor(principal / count);
  return Array.from({ length: count }, (_, index) => ({
    dueDate: addMonthsToDateKey(firstDueDate, index),
    amount: index === count - 1 ? principal - base * (count - 1) : base,
  }));
}

/**
 * Status of a schedule on a given day: payments cover installments in due-date
 * order. An unpaid installment is overdue the day after its due date.
 */
export function scheduleStatus(
  installments: { id: string; dueDate: string; amount: number }[],
  payments: number[],
  today: string,
): ScheduleStatus {
  const sorted = [...installments].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
  );
  const principal = sorted.reduce((sum, item) => sum + item.amount, 0);
  const paid = payments.reduce((sum, amount) => sum + amount, 0);

  let left = paid;
  const statuses = sorted.map((item): InstallmentStatus => {
    const covered = Math.min(left, item.amount);
    left -= covered;
    let state: InstallmentState;
    if (covered === item.amount) state = "paid";
    else if (item.dueDate < today) state = "overdue";
    else if (covered > 0) state = "partial";
    else state = "upcoming";
    return { ...item, paid: covered, state };
  });

  const next = statuses.find((item) => item.state !== "paid");
  const remaining = Math.max(0, principal - paid);
  return {
    installments: statuses,
    principal,
    paid,
    remaining,
    settled: remaining === 0,
    overdueCount: statuses.filter((item) => item.state === "overdue").length,
    nextDue: next ? { id: next.id, dueDate: next.dueDate, left: next.amount - next.paid } : null,
  };
}
