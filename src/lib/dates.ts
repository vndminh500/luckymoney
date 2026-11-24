/**
 * Date helpers. Instants are stored in UTC; months and days are derived from
 * the user's IANA time zone (e.g. "Asia/Ho_Chi_Minh"), never from the server's.
 *
 * Keys: a month is "YYYY-MM", a day is "YYYY-MM-DD".
 */

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MonthRange = {
  /** First instant of the month in the user's time zone (inclusive). */
  start: Date;
  /** First instant of the next month (exclusive). Query with `>= start AND < end`. */
  end: Date;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws RangeError for an unknown time zone. */
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

/** The calendar day ("YYYY-MM-DD") of an instant in the given time zone. */
export function toDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The month ("YYYY-MM") of an instant in the given time zone. */
export function toMonthKey(date: Date, timeZone: string): string {
  const { year, month } = getZonedParts(date, timeZone);
  return `${pad(year, 4)}-${pad(month)}`;
}

/** UTC offset (ms) in effect at an instant, e.g. +7h for Asia/Ho_Chi_Minh. */
function getOffsetMs(instant: number, timeZone: string): number {
  const p = getZonedParts(new Date(instant), timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * First instant of a calendar day in the given time zone. Usually local midnight;
 * when a DST change skips midnight, the first instant that exists on that day.
 */
export function startOfZonedDay(dateKey: string, timeZone: string): Date {
  const match = DATE_KEY.exec(dateKey);
  if (!match) {
    throw new RangeError(`Invalid date key "${dateKey}", expected YYYY-MM-DD`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  if (new Date(midnightAsUtc).getUTCDate() !== day) {
    throw new RangeError(`Invalid calendar date "${dateKey}"`);
  }

  // Offsets on both sides of any DST change near this day. Local midnight is
  // `midnightAsUtc - offset` for whichever offset is in effect at that moment;
  // the earliest candidate that falls on the requested day is the start of it.
  const offsets = new Set(
    [-DAY_MS, 0, DAY_MS].map((shift) => getOffsetMs(midnightAsUtc + shift, timeZone)),
  );
  const candidates = [...offsets]
    .map((offset) => midnightAsUtc - offset)
    .filter((instant) => toDateKey(new Date(instant), timeZone) === dateKey);

  if (candidates.length === 0) {
    throw new RangeError(`Cannot resolve start of "${dateKey}" in ${timeZone}`);
  }
  return new Date(Math.min(...candidates));
}

/** UTC range covering a month in the user's time zone: `[start, end)`. */
export function getMonthRange(monthKey: string, timeZone: string): MonthRange {
  assertMonthKey(monthKey);
  return {
    start: startOfZonedDay(`${monthKey}-01`, timeZone),
    end: startOfZonedDay(`${addMonths(monthKey, 1)}-01`, timeZone),
  };
}

/** Shifts a month key by `delta` months, e.g. addMonths("2026-12", 1) = "2027-01". */
export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = assertMonthKey(monthKey);
  const total = year * 12 + (month - 1) + delta;
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`;
}

export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone === "") {
    return false;
  }
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function assertMonthKey(monthKey: string): [year: number, month: number] {
  const match = MONTH_KEY.exec(monthKey);
  if (!match) {
    throw new RangeError(`Invalid month key "${monthKey}", expected YYYY-MM`);
  }
  return [Number(match[1]), Number(match[2])];
}

/** Parses "YYYY-MM-DD" into UTC midnight of that calendar day; throws if not a real date. */
function dateKeyToUtc(dateKey: string): number {
  const match = DATE_KEY.exec(dateKey);
  if (!match) {
    throw new RangeError(`Invalid date key "${dateKey}", expected YYYY-MM-DD`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day);
  if (new Date(utc).getUTCDate() !== day || new Date(utc).getUTCMonth() !== month - 1) {
    throw new RangeError(`Invalid calendar date "${dateKey}"`);
  }
  return utc;
}

function utcToDateKey(utc: number): string {
  const date = new Date(utc);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidDateKey(value: string): boolean {
  try {
    dateKeyToUtc(value);
    return true;
  } catch {
    return false;
  }
}

/** Shifts a calendar day by `delta` days (pure calendar math, no time zone involved). */
export function addDays(dateKey: string, delta: number): string {
  return utcToDateKey(dateKeyToUtc(dateKey) + delta * DAY_MS);
}

/** First day of the week; same values as the Prisma enum. */
export type WeekStart = "MONDAY" | "SUNDAY";

/** The first day of the week containing a day (Monday by default, or Sunday). */
export function startOfWeekKey(dateKey: string, weekStart: WeekStart = "MONDAY"): string {
  const weekday = new Date(dateKeyToUtc(dateKey)).getUTCDay(); // 0 = Sunday
  const offset = weekStart === "MONDAY" ? (weekday + 6) % 7 : weekday;
  return addDays(dateKey, -offset);
}

/** How dates are shown; same values as the Prisma enum. */
export type DateFormat = "DMY" | "ISO";

/** "2026-11-24" as "24/11/2026" (DMY) or unchanged (ISO). */
export function formatDateKey(dateKey: string, format: DateFormat): string {
  if (format === "ISO") {
    return dateKey;
  }
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

/** UTC range `[start, end)` covering `days` whole local days starting at `startKey`. */
export function getDayRange(startKey: string, days: number, timeZone: string): MonthRange {
  return {
    start: startOfZonedDay(startKey, timeZone),
    end: startOfZonedDay(addDays(startKey, days), timeZone),
  };
}
