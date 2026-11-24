import type { Metadata } from "next";
import { Suspense } from "react";

import { PasswordForm } from "@/components/account/password-form";
import { getAccount } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Bảo mật" };

export default function SecurityPage() {
  return (
    <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
      <Security />
    </Suspense>
  );
}

async function Security() {
  const user = await getCurrentUser();
  const account = await getAccount(user.id);
  return (
    <section
      aria-labelledby="password-heading"
      className="animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6"
    >
      <h2 id="password-heading" className="mb-1 text-lg font-bold">
        {account.hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
      </h2>
      <p className="mb-5 text-sm text-[var(--dash-muted)]">
        Các thiết bị khác đang đăng nhập vẫn giữ phiên cho tới khi hết hạn (tối đa 7 ngày).
      </p>
      <PasswordForm hasPassword={account.hasPassword} />
    </section>
  );
}
