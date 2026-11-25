import { z } from "zod";

import { isValidDateKey } from "@/lib/dates";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

export const NAME_MAX_LENGTH = 100;
export const BIRTH_DATE_MIN = "1900-01-01";

/** Lowercase letters, digits, "." and "_", 3 to 30 characters, starting and ending with a letter or digit. */
const USERNAME = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

/** "" (an emptied input) clears the field; a missing key leaves it unchanged. */
const clearable = (schema: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(schema.nullable())
    .optional();

/** Profile form (Tài khoản > Thông tin cá nhân). The email is not editable. */
export const profileSchema = z.object({
  name: clearable(
    z.string().max(NAME_MAX_LENGTH, { error: `Họ tên tối đa ${NAME_MAX_LENGTH} ký tự.` }),
  ),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value === "" ? null : value))
    .pipe(
      z
        .string()
        .regex(USERNAME, {
          error: "Tên đăng nhập gồm 3–30 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới.",
        })
        .nullable(),
    )
    .optional(),
  birthDate: clearable(
    z
      .string()
      .refine(isValidDateKey, { error: "Ngày sinh không hợp lệ." })
      .refine((value) => value >= BIRTH_DATE_MIN, { error: "Ngày sinh không hợp lệ." }),
  ),
});

const newPassword = z
  .string({ error: "Vui lòng nhập mật khẩu mới." })
  .min(PASSWORD_MIN_LENGTH, { error: `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` })
  .max(PASSWORD_MAX_LENGTH, { error: `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự.` });

/** Security form: the current password confirms the change. */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Vui lòng nhập mật khẩu hiện tại." })
      .min(1, { error: "Vui lòng nhập mật khẩu hiện tại." })
      .max(PASSWORD_MAX_LENGTH),
    newPassword,
    confirmPassword: z.string({ error: "Vui lòng nhập lại mật khẩu mới." }),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
