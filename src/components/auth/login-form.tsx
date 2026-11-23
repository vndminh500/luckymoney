"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";

/**
 * `callbackUrl` must already be validated by the caller. It is rendered by the
 * form itself (not streamed in separately), so re-renders can never drop it.
 */
export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <Field
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <Field
        name="password"
        type="password"
        label="Mật khẩu"
        autoComplete="current-password"
        required
      />
      <SubmitButton pending={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</SubmitButton>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-medium text-emerald-800 underline dark:text-emerald-400"
        >
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
