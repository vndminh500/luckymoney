import { z } from "zod";

import { isValidTimeZone } from "@/lib/dates";

export const AMOUNT_FORMATS = ["SYMBOL", "DONG", "SHORT"] as const;
export const DATE_FORMATS = ["DMY", "ISO"] as const;
export const WEEK_STARTS = ["MONDAY", "SUNDAY"] as const;
export const THEMES = ["SYSTEM", "LIGHT", "DARK"] as const;

/** Cài đặt > Tùy chỉnh tài chính. */
export const displayPreferencesSchema = z.object({
  amountFormat: z.enum(AMOUNT_FORMATS, { error: "Kiểu hiển thị số tiền không hợp lệ." }),
  dateFormat: z.enum(DATE_FORMATS, { error: "Định dạng ngày không hợp lệ." }),
  weekStart: z.enum(WEEK_STARTS, { error: "Ngày đầu tuần không hợp lệ." }),
  timeZone: z
    .string({ error: "Vui lòng chọn múi giờ." })
    .refine(isValidTimeZone, { error: "Múi giờ không hợp lệ." }),
});

export const themeSchema = z.object({
  theme: z.enum(THEMES, { error: "Giao diện không hợp lệ." }),
});

export const notificationPreferencesSchema = z.object({
  notifyBudgetWarning: z.boolean(),
  notifyBudgetOver: z.boolean(),
  notifyDebtEmail: z.boolean(),
});

export type Theme = (typeof THEMES)[number];
