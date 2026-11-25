"use client";

import { useActionState } from "react";

import { saveBudgetAction, type BudgetFormState } from "@/app/(app)/budgets/actions";
import type { SelectableCategory } from "@/server/categories/service";

const control =
  "h-12 w-full rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 text-base text-[var(--dash-text)] outline-none transition-[border-color,box-shadow] duration-200 ease-lm hover:border-lm-sky/70 focus-visible:border-lm-sky focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lm-aqua)_55%,transparent)] aria-invalid:border-red-600";

type Props = { month: string; categories: SelectableCategory[] };

/** Set or change the limit of one expense category for the month shown. */
export function BudgetForm({ month, categories }: Props) {
  const [state, formAction, pending] = useActionState<BudgetFormState, FormData>(
    saveBudgetAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form
      key={state.savedAt ?? "initial"}
      action={formAction}
      aria-label="Đặt ngân sách"
      className="grid gap-4 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-start"
      noValidate
    >
      <input type="hidden" name="month" value={month} />
      <div className="flex flex-col gap-2">
        <label htmlFor="budget-category" className="font-medium">
          Danh mục chi
        </label>
        <select
          id="budget-category"
          name="categoryId"
          defaultValue={state.values?.categoryId ?? ""}
          aria-invalid={errors.categoryId ? true : undefined}
          aria-describedby={errors.categoryId ? "budget-category-error" : undefined}
          className={control}
        >
          <option value="" disabled>
            Chọn danh mục
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId ? (
          <p id="budget-category-error" className="text-sm text-red-700 dark:text-red-400">
            {errors.categoryId}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="budget-amount" className="font-medium">
          Hạn mức
        </label>
        <input
          id="budget-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={state.values?.amount}
          aria-invalid={errors.amount ? true : undefined}
          aria-describedby={errors.amount ? "budget-amount-error" : "budget-amount-hint"}
          className={control}
        />
        {errors.amount ? (
          <p id="budget-amount-error" className="text-sm text-red-700 dark:text-red-400">
            {errors.amount}
          </p>
        ) : (
          <p id="budget-amount-hint" className="text-sm text-[var(--dash-muted)]">
            Ví dụ: 2tr, 500k
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-lm-sky px-5 font-bold text-lm-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--lm-sky)_35%,transparent)] transition-[background-color,transform] duration-200 ease-lm hover:bg-[var(--lm-sky-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98] disabled:opacity-80 sm:mt-8"
      >
        {pending ? "Đang lưu…" : "Lưu ngân sách"}
      </button>
      <p className="text-sm text-[var(--dash-muted)] sm:col-span-3">
        Chọn danh mục đã có ngân sách để đổi hạn mức của tháng này.
      </p>
    </form>
  );
}
