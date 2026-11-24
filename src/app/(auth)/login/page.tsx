import type { Metadata } from "next";

import { isGoogleSignInEnabled } from "@/auth";
import { AuthAlert } from "@/components/auth/auth-fields";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
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

/** Messages for the `?error=` codes Auth.js and our signIn callback redirect with. */
const SIGN_IN_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "Email này đã được đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.",
  AccessDenied: "Không thể đăng nhập bằng Google. Tài khoản Google cần có email đã được xác minh.",
};
const DEFAULT_SIGN_IN_ERROR = "Đăng nhập không thành công. Vui lòng thử lại.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl, error } = await searchParams;
  const safeCallbackUrl = safeRedirectPath(callbackUrl, "") || undefined;
  const errorCode = typeof error === "string" ? error : undefined;

  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Đăng nhập</h1>
      <p className="mt-2 mb-8 text-[var(--auth-muted)]">Tiếp tục ghi lại chi tiêu của bạn.</p>
      {errorCode ? (
        <div className="mb-5">
          <AuthAlert>{SIGN_IN_ERRORS[errorCode] ?? DEFAULT_SIGN_IN_ERROR}</AuthAlert>
        </div>
      ) : null}
      {isGoogleSignInEnabled ? <GoogleSignIn callbackUrl={safeCallbackUrl} /> : null}
      <LoginForm callbackUrl={safeCallbackUrl} />
    </>
  );
}
