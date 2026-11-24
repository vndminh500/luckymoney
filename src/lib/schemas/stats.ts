import { z } from "zod";

import { isValidMonthKey } from "@/lib/dates";
import { TRANSACTION_TYPES } from "@/lib/schemas/transaction";

/** Treats "" (an empty query value) as "not set". */
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const month = z.preprocess(
  blankToUndefined,
  z.string().refine(isValidMonthKey, { error: "Tháng không hợp lệ (YYYY-MM)." }).optional(),
);

/** Query of /api/stats/summary and /api/stats/daily. No month means the current one. */
export const statsQuerySchema = z.object({ month });

/** Query of /api/stats/by-category: expenses unless type=INCOME. */
export const statsByCategoryQuerySchema = z.object({
  month,
  type: z.preprocess(
    blankToUndefined,
    z
      .enum(TRANSACTION_TYPES, { error: "Loại giao dịch không hợp lệ." })
      .optional()
      .transform((value) => value ?? "EXPENSE"),
  ),
});
