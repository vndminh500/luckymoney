"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthAlert, AuthField, AuthSubmit, PasswordField } from "@/components/auth/auth-fields";

/**
 * `callbackUrl` must already be validated by the caller. It is rendered by the
 * form itself (not streamed in separately), so re-renders can never drop it.
 */
export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <AuthField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <PasswordField name="password" label="Mật khẩu" autoComplete="current-password" required />
      <Link
        href="/forgot-password"
        className="-mt-2 self-end text-sm font-medium text-lm-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep dark:text-lm-aqua"
      >
        Quên mật khẩu?
      </Link>
      <AuthSubmit pending={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</AuthSubmit>
    </form>
  );
}
