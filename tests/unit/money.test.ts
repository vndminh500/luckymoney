import { describe, expect, it } from "vitest";

import { formatMoney, formatVnd, formatVndCompact, parseVnd } from "@/lib/money";

// Intl puts a non-breaking space (U+00A0) between the number and the currency sign.
const NBSP = " ";

describe("formatVnd", () => {
  it.each([
    [0, `0${NBSP}₫`],
    [1, `1${NBSP}₫`],
    [50_000, `50.000${NBSP}₫`],
    [1_234_567, `1.234.567${NBSP}₫`],
    [1_000_000_000, `1.000.000.000${NBSP}₫`],
  ])("formats %i as %s", (amount, expected) => {
    expect(formatVnd(amount)).toBe(expected);
  });

  it("formats negative amounts (e.g. a negative balance)", () => {
    expect(formatVnd(-50_000)).toBe(`-50.000${NBSP}₫`);
  });

  it.each([0.5, 1000.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-integer amount %s",
    (amount) => {
      expect(() => formatVnd(amount)).toThrow(RangeError);
    },
  );
});

describe("parseVnd", () => {
  it.each([
    // plain numbers and thousands separators
    ["50000", 50_000],
    ["50.000", 50_000],
    ["50,000", 50_000],
    ["1.234.567", 1_234_567],
    ["50 000", 50_000],
    // "k" / "nghìn" / "ngàn" = thousand
    ["50k", 50_000],
    ["50K", 50_000],
    ["50 k", 50_000],
    ["50 nghìn", 50_000],
    ["50 ngàn", 50_000],
    ["1.5k", 1_500],
    ["1,5k", 1_500],
    ["2k5", 2_500],
    // "tr" / "triệu" / "m" = million
    ["2tr", 2_000_000],
    ["2 triệu", 2_000_000],
    ["2TR", 2_000_000],
    ["2m", 2_000_000],
    ["1.5tr", 1_500_000],
    ["1,25tr", 1_250_000],
    ["1tr5", 1_500_000],
    ["1tr25", 1_250_000],
    ["1.15tr", 1_150_000],
    // currency suffixes and surrounding whitespace
    ["50.000đ", 50_000],
    ["50.000 ₫", 50_000],
    ["50000 VND", 50_000],
    ["50000vnđ", 50_000],
    ["  50k  ", 50_000],
    ["0", 0],
  ])("parses %j as %i", (input, expected) => {
    expect(parseVnd(input)).toBe(expected);
  });

  it.each([0, 1, 50_000, 1_234_567, 1_000_000_000])(
    "round-trips formatVnd output for %i",
    (amount) => {
      expect(parseVnd(formatVnd(amount))).toBe(amount);
    },
  );

  it.each([
    "",
    "   ",
    "abc",
    "k",
    "-50k", // amounts are always positive; the type (income/expense) carries the sign
    "50kk",
    "50k tr",
    "1.5", // a dot without a unit must be a thousands separator (groups of 3)
    "1.50.000",
    "50.00",
    "1.2345k", // 1234.5 VND: VND has no sub-unit
    "1tr2345678", // too many fraction digits to be a whole number
    "12abc",
    "9".repeat(20), // beyond Number.MAX_SAFE_INTEGER
  ])("returns null for invalid input %j", (input) => {
    expect(parseVnd(input)).toBeNull();
  });
});

describe("formatVndCompact", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1_000, "1k"],
    [45_000, "45k"],
    [1_500, "1,5k"],
    [999_000, "999k"],
    [1_000_000, "1tr"],
    [1_500_000, "1,5tr"],
    [15_000_000, "15tr"],
    [2_250_000, "2,3tr"],
    [1_000_000_000, "1 tỷ"],
    [-45_000, "-45k"],
  ])("formats %i as %s", (amount, expected) => {
    expect(formatVndCompact(amount)).toBe(expected);
  });
});

describe("formatMoney", () => {
  it.each([
    ["SYMBOL", 50_000, `50.000${NBSP}₫`],
    ["DONG", 50_000, `50.000${NBSP}đ`],
    ["SHORT", 50_000, "50k"],
    ["SHORT", 1_500_000, "1,5tr"],
    ["SYMBOL", -45_000, `-45.000${NBSP}₫`],
    ["DONG", -45_000, `-45.000${NBSP}đ`],
  ] as const)("%s formats %i as %s", (format, amount, expected) => {
    expect(formatMoney(amount, format)).toBe(expected);
  });
});
