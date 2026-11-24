import { describe, expect, it } from "vitest";

import {
  AMOUNT_MAX,
  createTransactionSchema,
  NOTE_MAX_LENGTH,
  transactionFormSchema,
} from "@/lib/schemas/transaction";

const valid = {
  type: "EXPENSE",
  amount: 50_000,
  categoryId: "cat_1",
  occurredAt: "2026-11-24T05:00:00.000Z",
  note: "Phở",
};

function fieldsOf(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("createTransactionSchema", () => {
  it("accepts a valid transaction and converts occurredAt to a Date", () => {
    const result = createTransactionSchema.parse(valid);
    expect(result).toEqual({ ...valid, occurredAt: new Date("2026-11-24T05:00:00.000Z") });
  });

  it.each([0, -1, 1.5, AMOUNT_MAX + 1, "50000", Number.NaN])("rejects amount %s", (amount) => {
    const result = createTransactionSchema.safeParse({ ...valid, amount });
    expect(fieldsOf(result)).toEqual(["amount"]);
  });

  it("accepts the amount bounds 1 and 1_000_000_000", () => {
    expect(createTransactionSchema.safeParse({ ...valid, amount: 1 }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...valid, amount: AMOUNT_MAX }).success).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(fieldsOf(createTransactionSchema.safeParse({ ...valid, type: "TRANSFER" }))).toEqual([
      "type",
    ]);
  });

  it.each(["", "2026-13-01", "yesterday", "2026-11-24"])("rejects occurredAt %j", (occurredAt) => {
    expect(fieldsOf(createTransactionSchema.safeParse({ ...valid, occurredAt }))).toEqual([
      "occurredAt",
    ]);
  });

  it("requires a categoryId", () => {
    expect(fieldsOf(createTransactionSchema.safeParse({ ...valid, categoryId: "" }))).toEqual([
      "categoryId",
    ]);
  });

  it("trims the note, turns an empty note into null, and limits its length", () => {
    expect(createTransactionSchema.parse({ ...valid, note: "  Phở  " }).note).toBe("Phở");
    expect(createTransactionSchema.parse({ ...valid, note: "   " }).note).toBeNull();
    expect(createTransactionSchema.parse({ ...valid, note: undefined }).note).toBeNull();
    expect(
      createTransactionSchema.safeParse({ ...valid, note: "a".repeat(NOTE_MAX_LENGTH) }).success,
    ).toBe(true);
    expect(
      fieldsOf(
        createTransactionSchema.safeParse({ ...valid, note: "a".repeat(NOTE_MAX_LENGTH + 1) }),
      ),
    ).toEqual(["note"]);
  });

  it("drops fields that the client must not set, such as userId", () => {
    const result = createTransactionSchema.parse({ ...valid, userId: "someone-else", id: "x" });
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("id");
  });
});

describe("transactionFormSchema", () => {
  const form = {
    type: "EXPENSE",
    amount: "50k",
    categoryId: "cat_1",
    date: "2026-11-24",
    note: "",
  };

  it("parses shorthand amounts such as 50k and 1tr5", () => {
    expect(transactionFormSchema.parse(form).amount).toBe(50_000);
    expect(transactionFormSchema.parse({ ...form, amount: "1tr5" }).amount).toBe(1_500_000);
  });

  it.each(["", "abc", "0", "-5k", "2 tỷ"])("rejects amount %j", (amount) => {
    expect(fieldsOf(transactionFormSchema.safeParse({ ...form, amount }))).toEqual(["amount"]);
  });

  it.each(["", "24/11/2026", "2026-02-30"])("rejects date %j", (date) => {
    expect(fieldsOf(transactionFormSchema.safeParse({ ...form, date }))).toEqual(["date"]);
  });
});
