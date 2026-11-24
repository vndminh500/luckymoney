import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { brandPrimaryButton } from "@/components/ui/brand-form";

export default function NotFound() {
  return (
    <div className="dash-shell flex flex-1 flex-col items-center justify-center px-4 py-16">
      <main className="flex w-full max-w-md animate-lm-rise flex-col items-center gap-4 text-center">
        <LogoMark className="size-14" />
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">
          Không tìm thấy
        </h1>
        <p className="text-[var(--dash-muted)]">
          Trang hoặc giao dịch này không tồn tại, hoặc đã bị xóa.
        </p>
        <Link href="/transactions" className={`${brandPrimaryButton} mt-2`}>
          Về danh sách giao dịch
        </Link>
      </main>
    </div>
  );
}
