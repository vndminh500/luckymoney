import type { Metadata } from "next";

import { AuthAlert } from "@/components/auth/auth-fields";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Đăng nhập" };

/**
 * The page waits for searchParams on the server instead of streaming part of the
 * form behind Suspense. A streamed hidden input was briefly removed and re-added
 * by React after load, so a quick submit could lose callbackUrl. The login page
 * does not need instant navigation, so blocking here is the simpler, safe choice.
 */
export const instant = false;

/** Shown for any `?error=` code Auth.js redirects here with. */
const SIGN_IN_ERROR = "Đăng nhập không thành công. Vui lòng thử lại.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl, error } = await searchParams;
  const safeCallbackUrl = safeRedirectPath(callbackUrl, "") || undefined;
  const hasError = typeof error === "string" && error !== "";

  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Đăng nhập</h1>
      <p className="mt-2 mb-8 text-[var(--auth-muted)]">Tiếp tục ghi lại chi tiêu của bạn.</p>
      {hasError ? (
        <div className="mb-5">
          <AuthAlert>{SIGN_IN_ERROR}</AuthAlert>
        </div>
      ) : null}
      <LoginForm callbackUrl={safeCallbackUrl} />
    </>
  );
}
