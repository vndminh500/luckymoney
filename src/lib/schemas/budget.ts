import { z } from "zod";

import { isValidMonthKey } from "@/lib/dates";
import { parseVnd } from "@/lib/money";
import { AMOUNT_MAX } from "@/lib/schemas/transaction";

const month = z
  .string({ error: "Vui lòng chọn tháng." })
  .refine(isValidMonthKey, { error: "Tháng không hợp lệ (YYYY-MM)." });

const categoryId = z
  .string({ error: "Vui lòng chọn danh mục." })
  .min(1, { error: "Vui lòng chọn danh mục." });

const amount = z
  .number({ error: "Hạn mức phải là số." })
  .int({ error: "Hạn mức phải là số nguyên VND." })
  .min(1, { error: "Hạn mức phải lớn hơn 0." })
  .max(AMOUNT_MAX, { error: "Hạn mức tối đa là 1 tỷ đồng." });

/** Body of PUT /api/budgets: create or update the limit of (category, month). */
export const upsertBudgetSchema = z.object({ categoryId, month, amount });

/** The budget form: the limit is typed by hand ("2tr", "500k"). */
export const budgetFormSchema = z.object({
  categoryId,
  month,
  amount: z
    .string({ error: "Vui lòng nhập hạn mức." })
    .transform((value, ctx) => {
      const parsed = parseVnd(value);
      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: "Hạn mức không hợp lệ, ví dụ: 2000000, 2tr, 500k.",
        });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(amount),
});

/** Query of GET /api/budgets. No month means the current one. */
export const listBudgetsQuerySchema = z.object({
  month: z.preprocess((value) => (value === "" ? undefined : value), month.optional()),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
