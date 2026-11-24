import { describe, expect, it } from "vitest";

import { dayLabel, formatDmy, monthGrid, parseDateInput } from "@/lib/calendar";

describe("parseDateInput", () => {
  it.each([
    ["24/11/2026", "2026-11-24"],
    ["4/1/2026", "2026-01-04"],
    ["24-11-2026", "2026-11-24"],
    ["24.11.2026", "2026-11-24"],
    ["24112026", "2026-11-24"],
    [" 2026-11-24 ", "2026-11-24"],
    ["29/02/2028", "2028-02-29"],
  ])("reads %j as %s", (text, expected) => {
    expect(parseDateInput(text)).toBe(expected);
  });

  it.each(["", "abc", "31/11/2026", "29/02/2026", "24/13/2026", "1/1/26", "2026-02-30"])(
    "rejects %j",
    (text) => {
      expect(parseDateInput(text)).toBeNull();
    },
  );
});

describe("formatDmy", () => {
  it("shows a day key as dd/mm/yyyy", () => {
    expect(formatDmy("2026-01-04")).toBe("04/01/2026");
  });
});

describe("monthGrid", () => {
  it("covers the month in whole weeks starting on Monday", () => {
    const weeks = monthGrid("2026-11", "MONDAY");
    // 1/11/2026 is a Sunday: the first row starts on Monday 26/10.
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks).toHaveLength(6);
  });

  it("starts on Sunday when asked", () => {
    expect(monthGrid("2026-11", "SUNDAY")[0][0]).toBe("2026-11-01");
  });

  it("always has six rows so the calendar does not change height", () => {
    // February 2027 starts on a Monday and fits in four weeks.
    expect(monthGrid("2027-02", "MONDAY")).toHaveLength(6);
  });
});

describe("dayLabel", () => {
  it("names the day for screen readers", () => {
    expect(dayLabel("2026-11-24")).toBe("Thứ Ba, 24 tháng 11 năm 2026");
    expect(dayLabel("2026-11-22")).toBe("Chủ Nhật, 22 tháng 11 năm 2026");
  });
});
