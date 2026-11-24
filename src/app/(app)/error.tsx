"use client";

import Link from "next/link";
import { useEffect } from "react";

import { brandPrimaryButton, brandSecondaryButton } from "@/components/ui/brand-form";

/**
 * A page of the signed-in app failed to load (database down, unexpected bug).
 * The sidebar and the menu stay usable; the page can be retried in place.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-full bg-amber-100 text-2xl text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      >
        !
      </span>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">
        Không tải được trang này
      </h1>
      <p className="text-[var(--dash-muted)]">
        Đã có lỗi khi lấy dữ liệu. Dữ liệu của bạn không bị mất. Thử tải lại, hoặc quay về trang
        tổng quan.
      </p>
      {error.digest ? (
        <p className="text-sm text-[var(--dash-muted)]">Mã lỗi: {error.digest}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={brandPrimaryButton}>
          Thử lại
        </button>
        <Link href="/" className={`${brandSecondaryButton} h-12`}>
          Về trang tổng quan
        </Link>
      </div>
    </main>
  );
}
