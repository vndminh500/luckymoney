"use client";

import { useActionState, useEffect, useRef } from "react";

import { deleteCategoryAction, type DeleteCategoryState } from "@/app/(app)/categories/actions";
import { brandSecondaryButton, Spinner } from "@/components/ui/brand-form";
import type { CategoryDto } from "@/server/categories/service";

type Props = { category: CategoryDto; open: boolean; onClose: () => void };

/**
 * Confirmation before deleting a category, in a native modal <dialog> (focus
 * stays inside, Escape and the backdrop close it). A category that still has
 * transactions cannot be deleted; the dialog says why instead.
 */
export function DeleteCategoryDialog({ category, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<DeleteCategoryState, FormData>(
    deleteCategoryAction.bind(null, category.id),
    {},
  );
  const blocked = category.transactionCount > 0;
  const titleId = `delete-${category.id}-title`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-0 text-[var(--dash-text)] shadow-[0_30px_80px_rgb(6_43_69/0.35)] backdrop:bg-lm-ink/45 backdrop:backdrop-blur-[2px] open:animate-[lm-dialog-in_220ms_var(--ease-lm)] backdrop:open:animate-[lm-fade-in_220ms_ease-out]"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={`grid size-11 shrink-0 place-items-center rounded-full ${
              blocked
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {blocked ? (
                <>
                  <path d="M12 3 2.5 20h19z" />
                  <path d="M12 10v4M12 17h.01" />
                </>
              ) : (
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
              )}
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">
              {blocked ? "Chưa xóa được danh mục" : "Xóa danh mục?"}
            </h2>
            <p className="mt-1 flex items-center gap-2 font-medium">
              <span aria-hidden="true">{category.icon ?? "•"}</span>
              {category.name}
            </p>
          </div>
        </div>

        {blocked ? (
          <p className="text-[var(--dash-muted)]">
            Danh mục này còn{" "}
            <strong className="text-[var(--dash-text)]">
              {category.transactionCount} giao dịch
            </strong>
            . Hãy chuyển các giao dịch sang danh mục khác hoặc xóa chúng trước, rồi xóa danh mục.
          </p>
        ) : (
          <p className="text-[var(--dash-muted)]">
            Danh mục và ngân sách của nó sẽ bị xóa. Không thể hoàn tác.
          </p>
        )}
        {state.error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={brandSecondaryButton} autoFocus>
            {blocked ? "Đóng" : "Hủy"}
          </button>
          {blocked ? null : (
            <form action={formAction}>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white transition-[background-color,transform] duration-200 ease-lm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 active:scale-[0.98] disabled:opacity-80"
              >
                {pending ? <Spinner /> : null}
                {pending ? "Đang xóa…" : "Xóa danh mục"}
              </button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
