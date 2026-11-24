import type { Metadata } from "next";

import { isGoogleSignInEnabled } from "@/auth";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Tạo tài khoản</h1>
      <p className="mt-2 mb-8 text-[var(--auth-muted)]">Miễn phí. Chỉ cần email và mật khẩu.</p>
      {isGoogleSignInEnabled ? <GoogleSignIn /> : null}
      <RegisterForm />
    </>
  );
}
