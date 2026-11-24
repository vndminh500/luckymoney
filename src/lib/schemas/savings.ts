import { z } from "zod";

import { isValidDateKey } from "@/lib/dates";
import { CATEGORY_ICON_MAX_LENGTH } from "@/lib/schemas/category";
import { vndAmount } from "@/lib/schemas/debt";
import { NOTE_MAX_LENGTH } from "@/lib/schemas/transaction";

export const JAR_NAME_MAX_LENGTH = 50;
export const SAVINGS_ENTRY_KINDS = ["DEPOSIT", "WITHDRAW"] as const;

const name = z
  .string({ error: "Vui lòng nhập tên hũ." })
  .transform((value) => value.normalize("NFC").trim())
  .pipe(
    z
      .string()
      .min(1, { error: "Vui lòng nhập tên hũ." })
      .max(JAR_NAME_MAX_LENGTH, { error: `Tên hũ tối đa ${JAR_NAME_MAX_LENGTH} ký tự.` }),
  );

/** Trimmed emoji; empty means "no icon" (null). */
const icon = z
  .string()
  .trim()
  .max(CATEGORY_ICON_MAX_LENGTH, { error: "Biểu tượng quá dài." })
  .nullish()
  .transform((value) => value || null);

/** Body of POST /api/savings. Unknown keys such as userId are dropped. */
export const createJarSchema = z.object({ name, icon });

/** Body of PATCH /api/savings/:id: name and/or icon. */
export const updateJarSchema = z
  .object({ name: name.optional(), icon: icon.optional() })
  .refine((value) => value.name !== undefined || value.icon !== undefined, {
    error: "Cần ít nhất một trường để cập nhật.",
    path: ["body"],
  });

/** Body of POST /api/savings/:id/entries. */
export const entrySchema = z.object({
  kind: z.enum(SAVINGS_ENTRY_KINDS, { error: "Vui lòng chọn nạp hay rút." }),
  amount: vndAmount("số tiền"),
  occurredOn: z
    .string({ error: "Ngày không hợp lệ." })
    .refine(isValidDateKey, { error: "Ngày không hợp lệ." }),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH, { error: `Ghi chú tối đa ${NOTE_MAX_LENGTH} ký tự.` })
    .nullish()
    .transform((value) => value || null),
});
