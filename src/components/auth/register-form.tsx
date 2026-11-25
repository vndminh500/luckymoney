"use client";

import { useActionState } from "react";

import { registerAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthAlert, AuthField, AuthSubmit, PasswordField } from "@/components/auth/auth-fields";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <AuthField
        name="name"
        label="Tên (không bắt buộc)"
        autoComplete="name"
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <AuthField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={errors.email}
      />
      <PasswordField
        name="password"
        label="Mật khẩu"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`}
        error={errors.password}
      />
      <AuthSubmit pending={pending}>{pending ? "Đang tạo tài khoản…" : "Đăng ký"}</AuthSubmit>
    </form>
  );
}
