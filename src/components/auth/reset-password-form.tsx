"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { resetPasswordAction, type ResetPasswordState } from "@/app/(auth)/password-reset-actions";
import { AuthAlert, AuthSubmit, PasswordField } from "@/components/auth/auth-fields";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

/** New password + confirmation; on success a modal dialog sends the user to sign in. */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <>
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.error ? (
          <AuthAlert>
            {state.error}{" "}
            <Link href="/forgot-password" className="font-bold underline underline-offset-4">
              Yêu cầu mã mới
            </Link>
          </AuthAlert>
        ) : null}
        <PasswordField
          name="password"
          label="Mật khẩu mới"
          autoComplete="new-password"
          required
          hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`}
          error={state.fieldErrors?.password}
        />
        <PasswordField
          name="confirmPassword"
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirmPassword}
        />
        <AuthSubmit pending={pending}>{pending ? "Đang lưu…" : "Đổi mật khẩu"}</AuthSubmit>
      </form>
      {state.done ? <ResetSuccessDialog /> : null}
    </>
  );
}

function ResetSuccessDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="reset-success-title"
      aria-describedby="reset-success-text"
      // Esc closes the dialog; the only way on is signing in again.
      onClose={() => router.push("/login")}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-0 text-[var(--auth-text)] shadow-[0_30px_80px_rgb(6_43_69/0.35)] backdrop:bg-lm-ink/45 backdrop:backdrop-blur-[2px] open:animate-[lm-dialog-in_220ms_var(--ease-lm)] backdrop:open:animate-[lm-fade-in_220ms_ease-out]"
    >
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          ✓
        </span>
        <h2 id="reset-success-title" className="text-xl font-bold">
          Đổi mật khẩu thành công
        </h2>
        <p id="reset-success-text" className="text-[var(--auth-muted)]">
          Hãy đăng nhập bằng mật khẩu mới.
        </p>
        <Link
          href="/login"
          autoFocus
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-lm-sky font-bold text-lm-ink transition-colors duration-200 hover:bg-[var(--lm-sky-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep"
        >
          Đăng nhập
        </Link>
      </div>
    </dialog>
  );
}
