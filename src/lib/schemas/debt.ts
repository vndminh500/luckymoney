import { z } from "zod";

import { isValidDateKey } from "@/lib/dates";
import { parseVnd } from "@/lib/money";
import { AMOUNT_MAX, NOTE_MAX_LENGTH } from "@/lib/schemas/transaction";

export const DEBT_DIRECTIONS = ["I_OWE", "THEY_OWE"] as const;
export const COUNTERPARTY_MAX_LENGTH = 80;
export const INSTALLMENTS_MAX = 120;

const dateKey = (message: string) =>
  z.string({ error: message }).refine(isValidDateKey, { error: message });

/** A whole VND amount, also accepted as typed text ("2tr", "500k") from forms. */
export const vndAmount = (label: string) =>
  z
    .union([z.number(), z.string()], { error: `Vui lòng nhập ${label}.` })
    .transform((value, ctx) => {
      if (typeof value === "number") return value;
      const parsed = parseVnd(value);
      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: `${label[0].toUpperCase()}${label.slice(1)} không hợp lệ, ví dụ: 500k, 2tr.`,
        });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(
      z
        .number()
        .int({ error: `${label[0].toUpperCase()}${label.slice(1)} phải là số nguyên VND.` })
        .min(1, { error: `${label[0].toUpperCase()}${label.slice(1)} phải lớn hơn 0.` })
        .max(AMOUNT_MAX, { error: "Tối đa 1 tỷ đồng." }),
    );

const note = z
  .string()
  .trim()
  .max(NOTE_MAX_LENGTH, { error: `Ghi chú tối đa ${NOTE_MAX_LENGTH} ký tự.` })
  .nullish()
  .transform((value) => value || null);

/** A debt with its expected schedule; the installments must add up to the principal. */
export const debtSchema = z
  .object({
    direction: z.enum(DEBT_DIRECTIONS, { error: "Vui lòng chọn chiều nợ." }),
    counterparty: z
      .string({ error: "Vui lòng nhập tên người." })
      .trim()
      .min(1, { error: "Vui lòng nhập tên người." })
      .max(COUNTERPARTY_MAX_LENGTH, { error: `Tên tối đa ${COUNTERPARTY_MAX_LENGTH} ký tự.` }),
    principal: vndAmount("số tiền"),
    startDate: dateKey("Ngày vay không hợp lệ."),
    note,
    installments: z
      .array(
        z.object({
          dueDate: dateKey("Ngày trả không hợp lệ."),
          amount: vndAmount("số tiền kỳ trả"),
        }),
        {
          error: "Vui lòng thêm lịch trả.",
        },
      )
      .min(1, { error: "Cần ít nhất một kỳ trả." })
      .max(INSTALLMENTS_MAX, { error: `Tối đa ${INSTALLMENTS_MAX} kỳ trả.` }),
  })
  .superRefine((value, ctx) => {
    const total = value.installments.reduce((sum, item) => sum + item.amount, 0);
    if (total !== value.principal) {
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message: "Tổng các kỳ trả phải bằng số tiền nợ.",
      });
    }
  });

export const paymentSchema = z.object({
  amount: vndAmount("số tiền trả"),
  paidOn: dateKey("Ngày trả không hợp lệ."),
  note,
});

export type DebtInput = z.infer<typeof debtSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
