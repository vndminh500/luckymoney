"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { deleteDebtAction } from "@/app/(app)/debts/actions";
import { brandSecondaryButton, Spinner } from "@/components/ui/brand-form";

/** "Xóa" button and its confirmation, in a native modal <dialog>. */
export function DeleteDebtButton({ debtId, name }: { debtId: string; name: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`${brandSecondaryButton} text-red-700 dark:text-red-400`}
      >
        Xóa
      </button>
      <dialog
        ref={ref}
        aria-labelledby="delete-debt-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-0 text-[var(--dash-text)] shadow-[0_30px_80px_rgb(6_43_69/0.35)] backdrop:bg-lm-ink/45 backdrop:backdrop-blur-[2px] open:animate-[lm-dialog-in_220ms_var(--ease-lm)] backdrop:open:animate-[lm-fade-in_220ms_ease-out]"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="delete-debt-title" className="text-lg font-bold">
            Xóa khoản nợ với {name}?
          </h2>
          <p className="text-[var(--dash-muted)]">
            Lịch trả và các lần trả đã ghi cũng bị xóa. Không thể hoàn tác.
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={brandSecondaryButton}
              autoFocus
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => deleteDebtAction(debtId))}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white transition-[background-color,transform] duration-200 ease-lm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 active:scale-[0.98] disabled:opacity-80"
            >
              {pending ? <Spinner /> : null}
              {pending ? "Đang xóa…" : "Xóa khoản nợ"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
