"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { settleDebtAction, type SettleDebtState } from "@/app/(app)/debts/actions";
import { BrandAlert, brandSecondaryButton, Spinner } from "@/components/ui/brand-form";

type Props = {
  debtId: string;
  name: string;
  /** Already formatted for display. */
  remaining: string;
  date: string;
  openInstallments: number;
  /** "trả" for what I owe, "thu" for what I am owed. */
  verb: "trả" | "thu";
};

/** "Đã tất toán" button and its confirmation, in a native modal <dialog>. */
export function SettleDebtButton({ debtId, name, remaining, date, openInstallments, verb }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SettleDebtState, FormData>(async () => {
    const result = await settleDebtAction(debtId);
    if (!result.error) setOpen(false);
    return result;
  }, {});

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
        className={`${brandSecondaryButton} border-emerald-300 text-emerald-800 hover:border-emerald-500 dark:border-emerald-800 dark:text-emerald-300`}
      >
        <span aria-hidden="true">✓</span>
        Đã tất toán
      </button>
      <dialog
        ref={ref}
        aria-labelledby="settle-debt-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-0 text-[var(--dash-text)] shadow-[0_30px_80px_rgb(6_43_69/0.35)] backdrop:bg-lm-ink/45 backdrop:backdrop-blur-[2px] open:animate-[lm-dialog-in_220ms_var(--ease-lm)] backdrop:open:animate-[lm-fade-in_220ms_ease-out]"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              ✓
            </span>
            <div className="min-w-0">
              <h2 id="settle-debt-title" className="text-lg font-bold">
                Tất toán khoản nợ với {name}?
              </h2>
              <p className="mt-1 text-2xl font-bold tabular-nums">{remaining}</p>
            </div>
          </div>
          <p className="text-[var(--dash-muted)]">
            Ghi một lần {verb} <strong className="text-[var(--dash-text)]">{remaining}</strong> ngày{" "}
            {date} cho {openInstallments} kỳ còn lại. Khoản nợ chuyển sang “Đã xong”. Nếu bấm nhầm,
            hoàn tác lần {verb} này trong danh sách bên dưới.
          </p>
          {state.error ? <BrandAlert>{state.error}</BrandAlert> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={brandSecondaryButton}
              autoFocus
            >
              Hủy
            </button>
            <form action={formAction}>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white transition-[background-color,transform] duration-200 ease-lm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] disabled:opacity-80"
              >
                {pending ? <Spinner /> : null}
                {pending ? "Đang lưu…" : "Xác nhận tất toán"}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
