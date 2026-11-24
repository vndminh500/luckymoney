import { describe, expect, it } from "vitest";

import { budgetStatus, percentUsed } from "@/lib/budget";

describe("percentUsed", () => {
  it.each([
    [0, 100_000, 0],
    [50_000, 100_000, 50],
    [80_000, 100_000, 80],
    [100_000, 100_000, 100],
    [150_000, 100_000, 150],
    [1, 3, 33.3],
    [2, 3, 66.6], // rounded down, never up
    [79_999, 100_000, 79.9],
    [99_999, 100_000, 99.9],
    [1_000_000_000, 1, 100_000_000_000],
  ])("spent %i of %i is %d%%", (spent, limit, expected) => {
    expect(percentUsed(spent, limit)).toBe(expected);
  });

  it("rejects a non-positive limit", () => {
    expect(() => percentUsed(1, 0)).toThrow(RangeError);
  });
});

describe("budgetStatus", () => {
  it.each([
    [0, "ok"],
    [79.9, "ok"],
    [80, "warning"],
    [99.9, "warning"],
    [100, "over"],
    [250, "over"],
  ] as const)("%d%% is %s", (percent, expected) => {
    expect(budgetStatus(percent)).toBe(expected);
  });

  it("agrees with the displayed percentage right below a threshold", () => {
    // 79,999 of 100,000 shows as 79.9%, so it must not warn yet.
    expect(budgetStatus(percentUsed(79_999, 100_000))).toBe("ok");
    expect(budgetStatus(percentUsed(80_000, 100_000))).toBe("warning");
    expect(budgetStatus(percentUsed(99_999, 100_000))).toBe("warning");
    expect(budgetStatus(percentUsed(100_000, 100_000))).toBe("over");
  });
});
