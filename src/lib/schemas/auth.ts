import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// Upper bound keeps hashing cost predictable for very long inputs.
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string({ error: "Vui lòng nhập email." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Email không hợp lệ." }));

export const registerSchema = z.object({
  email,
  password: z
    .string({ error: "Vui lòng nhập mật khẩu." })
    .min(PASSWORD_MIN_LENGTH, { error: `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` })
    .max(PASSWORD_MAX_LENGTH, { error: `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự.` }),
  name: z
    .string()
    .trim()
    .max(100, { error: "Tên tối đa 100 ký tự." })
    .optional()
    .transform((value) => value || undefined),
});

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "Vui lòng nhập mật khẩu." })
    .min(1, { error: "Vui lòng nhập mật khẩu." })
    .max(PASSWORD_MAX_LENGTH),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
