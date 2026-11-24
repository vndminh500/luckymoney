"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createTransactionAction,
  type TransactionFormState,
  type TransactionFormValues,
} from "@/app/(app)/transactions/actions";
import { Field, SubmitButton } from "@/components/ui/form";
import { NOTE_MAX_LENGTH } from "@/lib/schemas/transaction";
import type { SelectableCategory } from "@/server/categories/service";

type TransactionType = SelectableCategory["type"];

const TYPE_LABELS: Record<TransactionType, string> = { EXPENSE: "Chi", INCOME: "Thu" };

const controlClass =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/30 aria-invalid:border-red-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

type FormAction = (
  state: TransactionFormState,
  formData: FormData,
) => Promise<TransactionFormState>;

type Props = {
  /** Categories that can be picked (for an edit, plus the current one if archived). */
  categories: SelectableCategory[];
  today: string;
  /** Defaults to creating a transaction; the edit page passes its bound update action. */
  action?: FormAction;
  /** Starting values, e.g. the transaction being edited. */
  initialValues?: TransactionFormValues;
  submitLabel?: string;
  /** Focus the amount on load (quick entry); off when editing. */
  autoFocusAmount?: boolean;
};

export function TransactionForm({
  categories,
  today,
  action = createTransactionAction,
  initialValues,
  submitLabel = "Lưu giao dịch",
  autoFocusAmount = true,
}: Props) {
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(action, {
    values: initialValues,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.savedId ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          Đã lưu giao dịch.{" "}
          <Link
            href={`/transactions?month=${state.values?.date.slice(0, 7) ?? ""}`}
            className="font-medium underline"
          >
            Xem danh sách
          </Link>
        </p>
      ) : null}
      {/* Remount the fields after each save so they reset to the returned values. */}
      <TransactionFields
        key={state.savedId ?? "initial"}
        categories={categories}
        today={today}
        state={state}
        autoFocusAmount={autoFocusAmount}
      />
      <SubmitButton pending={pending}>{pending ? "Đang lưu…" : submitLabel}</SubmitButton>
    </form>
  );
}

function TransactionFields({
  categories,
  today,
  state,
  autoFocusAmount,
}: Pick<Props, "categories" | "today" | "autoFocusAmount"> & { state: TransactionFormState }) {
  const values = state.values;
  const errors = state.fieldErrors ?? {};
  const [type, setType] = useState<TransactionType>(
    values?.type === "INCOME" ? "INCOME" : "EXPENSE",
  );
  const options = categories.filter((category) => category.type === type);

  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Loại</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_LABELS) as TransactionType[]).map((value) => (
            <label
              key={value}
              className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium has-checked:border-emerald-700 has-checked:bg-emerald-50 has-checked:text-emerald-900 has-focus-visible:ring-2 has-focus-visible:ring-emerald-700/30 dark:border-zinc-600 dark:has-checked:bg-emerald-950 dark:has-checked:text-emerald-200"
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {TYPE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        name="amount"
        label="Số tiền"
        inputMode="decimal"
        autoComplete="off"
        required
        autoFocus={autoFocusAmount}
        defaultValue={values?.amount}
        hint="Ví dụ: 50000, 50k, 1tr5"
        error={errors.amount}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium">
          Danh mục
        </label>
        <select
          // Re-mount when the type changes so the selection resets to the placeholder.
          key={type}
          id="categoryId"
          name="categoryId"
          required
          defaultValue={values?.type === type ? values.categoryId : ""}
          aria-invalid={errors.categoryId ? true : undefined}
          aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
          className={controlClass}
        >
          <option value="" disabled>
            Chọn danh mục
          </option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId ? (
          <p id="categoryId-error" className="text-sm text-red-700 dark:text-red-400">
            {errors.categoryId}
          </p>
        ) : null}
      </div>

      <Field
        name="date"
        type="date"
        label="Ngày"
        required
        defaultValue={values?.date || today}
        error={errors.date}
      />

      <Field
        name="note"
        label="Ghi chú (không bắt buộc)"
        autoComplete="off"
        maxLength={NOTE_MAX_LENGTH}
        defaultValue={values?.note}
        error={errors.note}
      />
      {errors.type ? <p className="text-sm text-red-700 dark:text-red-400">{errors.type}</p> : null}
    </>
  );
}
