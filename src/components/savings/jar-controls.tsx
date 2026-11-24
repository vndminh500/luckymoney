"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  deleteEntryAction,
  deleteJarAction,
  type UndoEntryState,
} from "@/app/(app)/savings/actions";
import { EditJarForm } from "@/components/savings/jar-forms";
import { brandSecondaryButton, Spinner } from "@/components/ui/brand-form";

type Jar = { id: string; name: string; icon: string | null };

/** "Sửa" (inline form) and "Xóa" (confirmation dialog) for a jar. */
export function JarControls({ jar, balance }: { jar: Jar; balance: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing((value) => !value)}
          className={brandSecondaryButton}
        >
          {editing ? "Đóng" : "Sửa"}
        </button>
        <DeleteJarButton jar={jar} balance={balance} />
      </div>
      {editing ? <EditJarForm jar={jar} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}

function DeleteJarButton({ jar, balance }: { jar: Jar; balance: string }) {
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
        aria-labelledby="delete-jar-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-0 text-[var(--dash-text)] shadow-[0_30px_80px_rgb(6_43_69/0.35)] backdrop:bg-lm-ink/45 backdrop:backdrop-blur-[2px] open:animate-[lm-dialog-in_220ms_var(--ease-lm)] backdrop:open:animate-[lm-fade-in_220ms_ease-out]"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="delete-jar-title" className="text-lg font-bold">
            Xóa hũ “{jar.name}”?
          </h2>
          <p className="text-[var(--dash-muted)]">
            Hũ đang có <strong className="text-[var(--dash-text)]">{balance}</strong>. Hũ và toàn bộ
            lịch sử nạp/rút sẽ bị xóa khỏi sổ. Không thể hoàn tác.
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
              onClick={() => startTransition(() => deleteJarAction(jar.id))}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white transition-[background-color,transform] duration-200 ease-lm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 active:scale-[0.98] disabled:opacity-80"
            >
              {pending ? <Spinner /> : null}
              {pending ? "Đang xóa…" : "Xóa hũ"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** "Hoàn tác" on one history line; explains when a spent deposit cannot be undone. */
export function UndoEntryButton({
  jarId,
  entryId,
  label,
}: {
  jarId: string;
  entryId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<UndoEntryState, FormData>(
    () => deleteEntryAction(jarId, entryId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        className="rounded-lg px-2 py-1 text-sm text-[var(--dash-muted)] transition-colors hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep disabled:opacity-60"
      >
        Hoàn tác
      </button>
      {state.error ? (
        <p role="alert" className="max-w-64 text-right text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
