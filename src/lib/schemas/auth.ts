import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// Upper bound keeps hashing cost predictable for very long inputs.
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string({ error: "Vui lòng nhập email." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Email không hợp lệ." }));

/** Rules for choosing a password (register and reset). */
const newPassword = z
  .string({ error: "Vui lòng nhập mật khẩu." })
  .min(PASSWORD_MIN_LENGTH, { error: `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` })
  .max(PASSWORD_MAX_LENGTH, { error: `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự.` });

export const registerSchema = z.object({
  email,
  password: newPassword,
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

export const forgotPasswordSchema = z.object({ email });

export const verifyResetCodeSchema = z.object({
  email,
  code: z
    .string({ error: "Vui lòng nhập mã." })
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, { error: "Mã gồm 6 chữ số." })),
});

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string({ error: "Vui lòng nhập lại mật khẩu." }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
