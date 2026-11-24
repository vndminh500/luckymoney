/**
 * Money helpers. Amounts are whole VND stored as integers (VND has no sub-unit);
 * floating point is never used for money. Formatting happens only in the UI layer.
 */

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

/** Formats an integer VND amount for display, e.g. 50000 -> "50.000 ₫". */
export function formatVnd(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`VND amount must be an integer, got ${amount}`);
  }
  return vndFormatter.format(amount);
}

/** Power of ten for each shorthand unit: k = thousand, tr/m = million. */
const UNIT_EXPONENTS: Record<string, number> = {
  k: 3,
  nghìn: 3,
  ngàn: 3,
  tr: 6,
  triệu: 6,
  m: 6,
};

const UNIT = "(k|nghìn|ngàn|tr|triệu|m)";
const CURRENCY_SUFFIX = /\s*(₫|vnđ|vnd|đồng|dong|đ)$/;

// "1.5tr", "1,5k", "50k", "50 nghìn"
const DECIMAL_WITH_UNIT = new RegExp(`^(\\d+)(?:[.,](\\d+))?\\s*${UNIT}$`);
// Vietnamese shorthand where digits after the unit are its fraction: "1tr5" = 1.5tr, "2k5" = 2.5k
const UNIT_SHORTHAND = new RegExp(`^(\\d+)\\s*${UNIT}(\\d+)$`);
// Plain digits, or digits grouped by 3 with one consistent separator: "50000", "50.000", "50,000", "50 000"
const PLAIN_NUMBER = /^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+)$/;

/**
 * Parses user input such as "50k", "1tr5", "1.5 triệu" or "50.000đ" into an
 * integer VND amount. Returns null when the input is not a whole, non-negative
 * VND amount. Range rules (e.g. amount > 0) belong to the validation schema.
 */
export function parseVnd(input: string): number | null {
  const text = input
    .normalize("NFC")
    .replace(/ /g, " ")
    .trim()
    .toLowerCase()
    .replace(CURRENCY_SUFFIX, "");

  if (PLAIN_NUMBER.test(text)) {
    return toSafeInteger(BigInt(text.replace(/[., ]/g, "")));
  }

  const decimal = DECIMAL_WITH_UNIT.exec(text);
  if (decimal) {
    const [, whole, fraction = "", unit] = decimal;
    return scaleByUnit(whole, fraction, UNIT_EXPONENTS[unit]);
  }

  const shorthand = UNIT_SHORTHAND.exec(text);
  if (shorthand) {
    const [, whole, unit, fraction] = shorthand;
    return scaleByUnit(whole, fraction, UNIT_EXPONENTS[unit]);
  }

  return null;
}

/**
 * Computes whole.fraction × 10^exponent exactly by shifting digits as text
 * (e.g. "1", "5", 6 -> "1500000"), or null if the result is not a whole number.
 */
function scaleByUnit(whole: string, fraction: string, exponent: number): number | null {
  if (fraction.length > exponent) {
    return null;
  }
  return toSafeInteger(BigInt(whole + fraction.padEnd(exponent, "0")));
}

function toSafeInteger(value: bigint): number | null {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

const compactNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

const COMPACT_UNITS: { size: number; suffix: string }[] = [
  { size: 1_000_000_000, suffix: " tỷ" },
  { size: 1_000_000, suffix: "tr" },
  { size: 1_000, suffix: "k" },
];

/**
 * Short label for chart axes, in the shorthand people type: 45k, 1,5tr, 1 tỷ.
 * Display only (one decimal, rounded); never parse it back into an amount.
 */
export function formatVndCompact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const value = Math.abs(amount);
  const unit = COMPACT_UNITS.find(({ size }) => value >= size);
  if (!unit) {
    return `${sign}${compactNumber.format(value)}`;
  }
  return `${sign}${compactNumber.format(value / unit.size)}${unit.suffix}`;
}
