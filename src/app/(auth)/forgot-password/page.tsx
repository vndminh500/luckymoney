import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Quên mật khẩu</h1>
      <p className="mt-2 mb-8 text-[var(--auth-muted)]">
        Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác nhận để bạn đặt mật khẩu mới.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
