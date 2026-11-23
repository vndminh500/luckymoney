import { describe, expect, it } from "vitest";

import {
  addMonths,
  getMonthRange,
  isValidMonthKey,
  isValidTimeZone,
  startOfZonedDay,
  toDateKey,
  toMonthKey,
} from "@/lib/dates";

const VN = "Asia/Ho_Chi_Minh"; // UTC+7, no DST
const NY = "America/New_York"; // DST: UTC-5 / UTC-4

const utc = (iso: string): Date => new Date(iso);

describe("toMonthKey / toDateKey", () => {
  it("uses the user's time zone, not UTC, at the start of a month", () => {
    // 2026-10-31 17:00 UTC is already 2026-11-01 00:00 in Vietnam.
    expect(toMonthKey(utc("2026-10-31T16:59:59.999Z"), VN)).toBe("2026-10");
    expect(toMonthKey(utc("2026-10-31T17:00:00.000Z"), VN)).toBe("2026-11");
    expect(toDateKey(utc("2026-10-31T17:00:00.000Z"), VN)).toBe("2026-11-01");
  });

  it("uses the user's time zone at the end of a month", () => {
    // Still November in UTC, already December in Vietnam.
    expect(toMonthKey(utc("2026-11-30T17:00:00.000Z"), "UTC")).toBe("2026-11");
    expect(toMonthKey(utc("2026-11-30T17:00:00.000Z"), VN)).toBe("2026-12");
  });

  it("handles negative offsets", () => {
    // 2026-12-01 03:00 UTC is still 2026-11-30 22:00 in New York.
    expect(toMonthKey(utc("2026-12-01T03:00:00.000Z"), NY)).toBe("2026-11");
    expect(toDateKey(utc("2026-12-01T03:00:00.000Z"), NY)).toBe("2026-11-30");
  });

  it("handles the year boundary", () => {
    expect(toMonthKey(utc("2026-12-31T16:59:59.999Z"), VN)).toBe("2026-12");
    expect(toMonthKey(utc("2026-12-31T17:00:00.000Z"), VN)).toBe("2027-01");
  });
});

describe("getMonthRange", () => {
  it("returns a half-open UTC range [start, end) for Vietnam", () => {
    const { start, end } = getMonthRange("2026-11", VN);
    expect(start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });

  it("crosses into the next year for December", () => {
    const { start, end } = getMonthRange("2026-12", VN);
    expect(start.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("handles February in leap and non-leap years", () => {
    expect(getMonthRange("2028-02", "UTC").end.toISOString()).toBe("2028-03-01T00:00:00.000Z");
    expect(getMonthRange("2027-02", "UTC").end.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });

  it("uses the offset in effect at each boundary across DST changes", () => {
    // March 2026 starts in EST (UTC-5) and ends in EDT (UTC-4).
    const march = getMonthRange("2026-03", NY);
    expect(march.start.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(march.end.toISOString()).toBe("2026-04-01T04:00:00.000Z");
    // DST ends on 2026-11-01 at 02:00 local, so midnight is still EDT.
    const november = getMonthRange("2026-11", NY);
    expect(november.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(november.end.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("handles non-whole-hour offsets", () => {
    // India is UTC+5:30.
    expect(getMonthRange("2026-01", "Asia/Kolkata").start.toISOString()).toBe(
      "2025-12-31T18:30:00.000Z",
    );
  });

  it("agrees with toMonthKey at both edges", () => {
    for (const timeZone of [VN, NY, "UTC", "Asia/Kolkata", "Australia/Lord_Howe"]) {
      for (const month of ["2026-01", "2026-03", "2026-10", "2026-11", "2026-12"]) {
        const { start, end } = getMonthRange(month, timeZone);
        expect(toMonthKey(start, timeZone)).toBe(month);
        expect(toMonthKey(new Date(end.getTime() - 1), timeZone)).toBe(month);
        expect(toMonthKey(end, timeZone)).toBe(addMonths(month, 1));
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() => getMonthRange("2026-13", VN)).toThrow(RangeError);
    expect(() => getMonthRange("2026-1", VN)).toThrow(RangeError);
    expect(() => getMonthRange("2026-11", "Not/AZone")).toThrow(RangeError);
  });
});

describe("startOfZonedDay", () => {
  it("returns local midnight as a UTC instant", () => {
    expect(startOfZonedDay("2026-11-23", VN).toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("returns the first existing instant when midnight is skipped by DST", () => {
    // Chile moves clocks from 00:00 to 01:00 on 2026-09-06: midnight does not exist.
    const start = startOfZonedDay("2026-09-06", "America/Santiago");
    expect(start.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(toDateKey(start, "America/Santiago")).toBe("2026-09-06");
    expect(toDateKey(new Date(start.getTime() - 1), "America/Santiago")).toBe("2026-09-05");
  });

  it("rejects invalid dates", () => {
    expect(() => startOfZonedDay("2026-02-30", VN)).toThrow(RangeError);
    expect(() => startOfZonedDay("2026-2-3", VN)).toThrow(RangeError);
  });
});

describe("addMonths", () => {
  it.each([
    ["2026-11", 1, "2026-12"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-05", 0, "2026-05"],
    ["2026-05", 24, "2028-05"],
    ["2026-05", -17, "2024-12"],
  ])("%s + %i = %s", (month, delta, expected) => {
    expect(addMonths(month, delta)).toBe(expected);
  });
});

describe("validators", () => {
  it.each([
    ["2026-11", true],
    ["2026-01", true],
    ["2026-00", false],
    ["2026-13", false],
    ["2026-1", false],
    ["26-11", false],
    ["2026/11", false],
  ])("isValidMonthKey(%j) = %s", (value, expected) => {
    expect(isValidMonthKey(value)).toBe(expected);
  });

  it.each([
    [VN, true],
    ["UTC", true],
    ["Not/AZone", false],
    ["", false],
  ])("isValidTimeZone(%j) = %s", (value, expected) => {
    expect(isValidTimeZone(value)).toBe(expected);
  });
});
