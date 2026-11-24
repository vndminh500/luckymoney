"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createTransactionAction,
  type TransactionFormState,
  type TransactionFormValues,
} from "@/app/(app)/transactions/actions";
import { BrandField, BrandSelect, brandPrimaryButton, Spinner } from "@/components/ui/brand-form";
import { NOTE_MAX_LENGTH } from "@/lib/schemas/transaction";
import type { SelectableCategory } from "@/server/categories/service";

type TransactionType = SelectableCategory["type"];

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "EXPENSE", label: "Chi" },
  { value: "INCOME", label: "Thu" },
];

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
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.savedId ? (
        <p
          // A new key per save replays the entrance, so each save is visibly confirmed.
          key={state.savedId}
          role="status"
          className="flex animate-lm-rise flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-lm-mint bg-lm-lime/60 px-4 py-3 text-lm-ink [animation-duration:320ms] dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
        >
          <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.15" />
            <path
              d="m6 10.5 2.5 2.5L14 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Đã lưu giao dịch.
          <Link
            href={`/transactions?month=${state.values?.date.slice(0, 7) ?? ""}`}
            className="font-medium underline underline-offset-4"
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
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={brandPrimaryButton}
      >
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : submitLabel}
      </button>
    </form>
  );
}

/** Expense/income switch: a pill slides to the chosen side. */
function TypeSwitch({
  type,
  onChange,
}: {
  type: TransactionType;
  onChange: (type: TransactionType) => void;
}) {
  const index = TYPES.findIndex((option) => option.value === type);
  return (
    <fieldset>
      <legend className="mb-2 font-medium">Loại</legend>
      <div className="relative grid grid-cols-2 rounded-full bg-[var(--dash-track)] p-1">
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full shadow-[0_4px_12px_rgb(48_175_255/0.25)] transition-[transform,background-color] duration-300 ease-lm ${
            type === "EXPENSE" ? "bg-lm-sky" : "bg-lm-mint"
          }`}
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {TYPES.map((option) => (
          <label
            key={option.value}
            className="relative z-10 flex h-11 cursor-pointer items-center justify-center rounded-full font-bold text-[var(--dash-muted)] transition-colors duration-300 has-checked:text-lm-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lm-deep"
          >
            <input
              type="radio"
              name="type"
              value={option.value}
              checked={type === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
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
      <TypeSwitch type={type} onChange={setType} />

      <BrandField
        name="amount"
        label="Số tiền"
        inputMode="decimal"
        autoComplete="off"
        placeholder="50k"
        required
        autoFocus={autoFocusAmount}
        defaultValue={values?.amount}
        hint="Ví dụ: 50000, 50k, 1tr5"
        error={errors.amount}
        variant="large"
      />

      <BrandSelect
        // Re-mount when the type changes so the selection resets to the placeholder.
        key={type}
        name="categoryId"
        label="Danh mục"
        required
        defaultValue={values?.type === type ? values.categoryId : ""}
        error={errors.categoryId}
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
      </BrandSelect>

      <div className="grid gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <BrandField
          name="date"
          type="date"
          label="Ngày"
          required
          defaultValue={values?.date || today}
          error={errors.date}
        />
        <BrandField
          name="note"
          label="Ghi chú (không bắt buộc)"
          autoComplete="off"
          placeholder="Phở bò, đổ xăng…"
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={values?.note}
          error={errors.note}
        />
      </div>
      {errors.type ? <p className="text-sm text-red-700 dark:text-red-400">{errors.type}</p> : null}
    </>
  );
}
