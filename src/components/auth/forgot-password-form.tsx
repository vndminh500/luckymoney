"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestResetCodeAction,
  verifyResetCodeAction,
  type ForgotPasswordState,
} from "@/app/(auth)/password-reset-actions";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-fields";

/**
 * Both steps share one form state. The code step posts `step=code`, so Enter or
 * "Xác nhận" checks the code; only "Gửi lại mã" adds `resend` and only
 * "Đổi email" adds `changeEmail`.
 */
async function forgotPasswordStep(
  previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (formData.has("changeEmail")) {
    // Back to step 1 without a server call, keeping the email to fix it.
    return { step: "email", email: String(formData.get("email") ?? "") };
  }
  const verify = formData.get("step") === "code" && !formData.has("resend");
  return verify
    ? verifyResetCodeAction(previous, formData)
    : requestResetCodeAction(previous, formData);
}

const linkClass =
  "font-medium text-lm-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep dark:text-lm-aqua";

/** Step 1: email. Step 2: the 6-digit code from the email, with "Gửi lại mã". */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordStep, { step: "email" });

  if (state.step === "email") {
    return (
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
        <AuthField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />
        <AuthSubmit pending={pending}>{pending ? "Đang gửi…" : "Gửi mã"}</AuthSubmit>
        <Link href="/login" className={`${linkClass} self-center`}>
          Quay lại đăng nhập
        </Link>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.notice ? (
        <p
          role="status"
          className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] px-4 py-3"
        >
          {state.notice} Mã gồm 6 chữ số, hết hạn sau 10 phút.
        </p>
      ) : null}
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <input type="hidden" name="step" value="code" />
      <input type="hidden" name="email" value={state.email ?? ""} />
      <AuthField
        name="code"
        label="Mã xác nhận"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={12}
        required
        autoFocus
        error={state.fieldErrors?.code}
      />
      <AuthSubmit pending={pending}>{pending ? "Đang kiểm tra…" : "Xác nhận"}</AuthSubmit>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          name="resend"
          value="1"
          disabled={pending}
          className={`${linkClass} disabled:opacity-60`}
        >
          Gửi lại mã
        </button>
        <button
          type="submit"
          name="changeEmail"
          value="1"
          disabled={pending}
          className={`${linkClass} disabled:opacity-60`}
        >
          Đổi email
        </button>
      </div>
      <Link href="/login" className={`${linkClass} self-center`}>
        Quay lại đăng nhập
      </Link>
    </form>
  );
}
