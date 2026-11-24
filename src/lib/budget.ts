/** Thresholds of PRD F5: warn at 80% of the limit, alert at 100%. */
export const BUDGET_WARNING_PERCENT = 80;
export const BUDGET_OVER_PERCENT = 100;

export type BudgetStatus = "ok" | "warning" | "over";

/**
 * Share of the limit already spent, with one decimal, rounded DOWN on integers.
 * Rounding down keeps the shown number honest: 79,999 of 100,000 reads 79.9%,
 * never 80%, so the number and the warning always agree.
 */
export function percentUsed(spent: number, limit: number): number {
  if (!(limit > 0)) {
    throw new RangeError(`Budget limit must be positive, got ${limit}`);
  }
  return Math.floor((spent * 1000) / limit) / 10;
}

/** Status for a percentage from percentUsed. */
export function budgetStatus(percent: number): BudgetStatus {
  if (percent >= BUDGET_OVER_PERCENT) {
    return "over";
  }
  return percent >= BUDGET_WARNING_PERCENT ? "warning" : "ok";
}
