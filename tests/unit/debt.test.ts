import { describe, expect, it } from "vitest";

import { addMonthsToDateKey, scheduleStatus, splitEvenly } from "@/lib/debt";

describe("addMonthsToDateKey", () => {
  it.each([
    ["2026-01-15", 1, "2026-02-15"],
    ["2026-01-31", 1, "2026-02-28"], // clamps to the last day of a short month
    ["2028-01-31", 1, "2028-02-29"], // leap year
    ["2026-11-30", 3, "2027-02-28"],
    ["2026-12-05", 1, "2027-01-05"],
  ])("%s + %i months = %s", (dateKey, months, expected) => {
    expect(addMonthsToDateKey(dateKey, months)).toBe(expected);
  });
});

describe("splitEvenly", () => {
  it("splits into monthly installments, the remainder on the last one", () => {
    expect(splitEvenly(10_000_000, 3, "2026-12-05")).toEqual([
      { dueDate: "2026-12-05", amount: 3_333_333 },
      { dueDate: "2027-01-05", amount: 3_333_333 },
      { dueDate: "2027-02-05", amount: 3_333_334 },
    ]);
  });

  it("keeps the exact total", () => {
    const parts = splitEvenly(1_000_001, 7, "2026-01-31");
    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBe(1_000_001);
    expect(parts.map((part) => part.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
    ]);
  });

  it("makes a single installment for count 1", () => {
    expect(splitEvenly(500_000, 1, "2026-12-01")).toEqual([
      { dueDate: "2026-12-01", amount: 500_000 },
    ]);
  });
});

describe("scheduleStatus", () => {
  const installments = [
    { id: "a", dueDate: "2026-10-05", amount: 1_000_000 },
    { id: "b", dueDate: "2026-11-05", amount: 1_000_000 },
    { id: "c", dueDate: "2026-12-05", amount: 1_000_000 },
  ];

  it("applies payments to the earliest installments first", () => {
    const status = scheduleStatus(installments, [1_500_000], "2026-11-24");

    expect(status.installments).toEqual([
      { id: "a", dueDate: "2026-10-05", amount: 1_000_000, paid: 1_000_000, state: "paid" },
      { id: "b", dueDate: "2026-11-05", amount: 1_000_000, paid: 500_000, state: "overdue" },
      { id: "c", dueDate: "2026-12-05", amount: 1_000_000, paid: 0, state: "upcoming" },
    ]);
    expect(status).toMatchObject({
      principal: 3_000_000,
      paid: 1_500_000,
      remaining: 1_500_000,
      settled: false,
      overdueCount: 1,
      nextDue: { id: "b", dueDate: "2026-11-05", left: 500_000 },
    });
  });

  it("marks a partly paid installment that is not due yet as partial", () => {
    const status = scheduleStatus(installments, [1_200_000], "2026-10-20");
    expect(status.installments.map((i) => i.state)).toEqual(["paid", "partial", "upcoming"]);
    expect(status.overdueCount).toBe(0);
  });

  it("is due on the due date itself, overdue only the day after", () => {
    expect(scheduleStatus(installments, [], "2026-10-05").installments[0].state).toBe("upcoming");
    expect(scheduleStatus(installments, [], "2026-10-06").installments[0].state).toBe("overdue");
  });

  it("is settled once everything is paid, with no next due date", () => {
    const status = scheduleStatus(installments, [2_000_000, 1_000_000], "2027-01-01");
    expect(status).toMatchObject({ remaining: 0, settled: true, overdueCount: 0, nextDue: null });
    expect(status.installments.every((i) => i.state === "paid")).toBe(true);
  });

  it("sorts installments by due date whatever the input order", () => {
    const status = scheduleStatus([...installments].reverse(), [], "2026-09-01");
    expect(status.installments.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
