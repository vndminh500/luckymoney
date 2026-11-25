import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";

import { AuthAlert } from "@/components/auth/auth-fields";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isResetTicketValid } from "@/server/auth/password-reset";
import { RESET_TICKET_COOKIE } from "@/server/auth/reset-cookie";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

/** Reads the ticket cookie on every request; nothing here can be prerendered. */
export const instant = false;

export default async function ResetPasswordPage() {
  await connection();
  const ticket = (await cookies()).get(RESET_TICKET_COOKIE)?.value;
  const valid = ticket ? await isResetTicketValid(ticket, new Date()) : false;

  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">
        Đặt lại mật khẩu
      </h1>
      <p className="mt-2 mb-8 text-[var(--auth-muted)]">Chọn mật khẩu mới cho tài khoản của bạn.</p>
      {valid ? (
        <ResetPasswordForm />
      ) : (
        <AuthAlert>
          Phiên đặt lại đã hết hạn hoặc không hợp lệ.{" "}
          <Link href="/forgot-password" className="font-bold underline underline-offset-4">
            Yêu cầu mã mới
          </Link>
        </AuthAlert>
      )}
    </>
  );
}
