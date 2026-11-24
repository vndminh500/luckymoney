import { z } from "zod";

import { parseVnd } from "@/lib/money";

export const AMOUNT_MAX = 1_000_000_000;
export const NOTE_MAX_LENGTH = 200;

export const TRANSACTION_TYPES = ["EXPENSE", "INCOME"] as const;

const type = z.enum(TRANSACTION_TYPES, { error: "Loại giao dịch không hợp lệ." });

const amount = z
  .number({ error: "Số tiền phải là số." })
  .int({ error: "Số tiền phải là số nguyên VND." })
  .min(1, { error: "Số tiền phải lớn hơn 0." })
  .max(AMOUNT_MAX, { error: "Số tiền tối đa là 1 tỷ đồng." });

const categoryId = z
  .string({ error: "Vui lòng chọn danh mục." })
  .min(1, { error: "Vui lòng chọn danh mục." });

/** Trimmed note; an empty or missing note is stored as null. */
const note = z
  .string()
  .trim()
  .max(NOTE_MAX_LENGTH, { error: `Ghi chú tối đa ${NOTE_MAX_LENGTH} ký tự.` })
  .nullish()
  .transform((value) => value || null);

/** Body of POST /api/transactions (docs/api.md). Unknown keys such as userId are dropped. */
export const createTransactionSchema = z.object({
  type,
  amount,
  categoryId,
  occurredAt: z.iso
    .datetime({ offset: true, error: "Thời điểm không hợp lệ (cần ISO 8601)." })
    .transform((value) => new Date(value)),
  note,
});

/** True for a real calendar date written as YYYY-MM-DD. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Fields of the "add transaction" form. The amount is typed by hand ("50k",
 * "1tr5") and the date is a calendar day in the user's time zone.
 */
export const transactionFormSchema = z.object({
  type,
  amount: z
    .string({ error: "Vui lòng nhập số tiền." })
    .transform((value, ctx) => {
      const parsed = parseVnd(value);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message: "Số tiền không hợp lệ, ví dụ: 50000, 50k, 1tr5." });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(amount),
  categoryId,
  date: z
    .string({ error: "Vui lòng chọn ngày." })
    .refine(isCalendarDate, { error: "Ngày không hợp lệ." }),
  note,
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type TransactionFormInput = z.infer<typeof transactionFormSchema>;
