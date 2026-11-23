"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction, type AuthFormState } from "@/app/(auth)/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      <Field
        name="name"
        label="Tên (không bắt buộc)"
        autoComplete="name"
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <Field
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={errors.email}
      />
      <Field
        name="password"
        type="password"
        label="Mật khẩu"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`}
        error={errors.password}
      />
      <SubmitButton pending={pending}>{pending ? "Đang tạo tài khoản…" : "Đăng ký"}</SubmitButton>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-800 underline dark:text-emerald-400"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
