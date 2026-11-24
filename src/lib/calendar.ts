/**
 * Calendar helpers for the date picker (pure, calendar day keys "YYYY-MM-DD").
 */
import { addDays, isValidDateKey, startOfWeekKey, type WeekStart } from "@/lib/dates";

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export const WEEKDAY_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

/** Column headers, Sunday first like Date#getUTCDay. */
export const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/**
 * A typed date: "24/11/2026", "4/1/2026", "24-11-2026", "24.11.2026",
 * "24112026" or "2026-11-24". Null unless it is a real calendar day.
 */
export function parseDateInput(text: string): string | null {
  const value = text.trim();
  let key: string | null = null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (iso) key = `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
  else if (dmy) key = `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
  else if (compact) key = `${compact[3]}-${compact[2]}-${compact[1]}`;
  return key && isValidDateKey(key) ? key : null;
}

export function formatDmy(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

const weekday = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();

/** "Thứ Ba, 24 tháng 11 năm 2026". */
export function dayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${WEEKDAY_NAMES[weekday(dateKey)]}, ${day} tháng ${month} năm ${year}`;
}

/** Six whole weeks covering a month ("YYYY-MM"), so the calendar keeps one height. */
export function monthGrid(monthKey: string, weekStart: WeekStart): string[][] {
  let day = startOfWeekKey(`${monthKey}-01`, weekStart);
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => {
      const current = day;
      day = addDays(day, 1);
      return current;
    }),
  );
}

/** Weekday headers in grid order. */
export function weekdayHeaders(weekStart: WeekStart): { short: string; name: string }[] {
  const order = weekStart === "MONDAY" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return order.map((index) => ({ short: WEEKDAY_SHORT[index], name: WEEKDAY_NAMES[index] }));
}
