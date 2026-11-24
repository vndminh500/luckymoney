import { z } from "zod";

import { TRANSACTION_TYPES } from "@/lib/schemas/transaction";

export const CATEGORY_NAME_MAX_LENGTH = 50;
/** Room for an emoji with modifiers (several UTF-16 code units). */
export const CATEGORY_ICON_MAX_LENGTH = 16;

const name = z
  .string({ error: "Vui lòng nhập tên danh mục." })
  .transform((value) => value.normalize("NFC").trim())
  .pipe(
    z
      .string()
      .min(1, { error: "Vui lòng nhập tên danh mục." })
      .max(CATEGORY_NAME_MAX_LENGTH, {
        error: `Tên danh mục tối đa ${CATEGORY_NAME_MAX_LENGTH} ký tự.`,
      }),
  );

/** Trimmed icon; empty means "no icon" (null). */
const icon = z
  .string()
  .trim()
  .max(CATEGORY_ICON_MAX_LENGTH, { error: "Biểu tượng quá dài." })
  .nullish()
  .transform((value) => value || null);

/** Body of POST /api/categories. Unknown keys such as userId are dropped. */
export const createCategorySchema = z.object({
  name,
  type: z.enum(TRANSACTION_TYPES, { error: "Loại danh mục không hợp lệ." }),
  icon,
});

/** Body of PATCH /api/categories/:id: name and/or icon. The type never changes. */
export const updateCategorySchema = z
  .object({ name: name.optional(), icon: icon.optional() })
  .refine((value) => value.name !== undefined || value.icon !== undefined, {
    error: "Cần ít nhất một trường để cập nhật.",
    path: ["body"],
  });

/** Query of GET /api/categories. */
export const listCategoriesQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"], { error: "includeArchived phải là true hoặc false." })
    .optional()
    .transform((value) => value === "true"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
