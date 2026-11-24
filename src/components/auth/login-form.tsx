"use client";

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
        placeholder="ban@email.com"
        required
        defaultValue={state.values?.email}
      />
      <PasswordField name="password" label="Mật khẩu" autoComplete="current-password" required />
      <AuthSubmit pending={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</AuthSubmit>
    </form>
  );
}
