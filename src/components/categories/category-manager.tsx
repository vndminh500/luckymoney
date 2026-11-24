"use client";

import { useActionState, useState } from "react";

import {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  restoreCategoryAction,
  type CategoryFormState,
} from "@/app/(app)/categories/actions";
import { IconPicker } from "@/components/categories/icon-picker";
import {
  BrandField,
  brandPrimaryButton,
  brandSecondaryButton,
  FieldMessages,
  Spinner,
} from "@/components/ui/brand-form";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/schemas/category";
import type { CategoryDto } from "@/server/categories/service";

const TYPES = [
  { value: "EXPENSE", label: "Chi" },
  { value: "INCOME", label: "Thu" },
] as const;

/** Expense/income switch with a sliding pill (same look as the transaction form). */
function TypeSwitch({ defaultValue }: { defaultValue: string }) {
  const [type, setType] = useState(defaultValue === "INCOME" ? "INCOME" : "EXPENSE");
  const index = TYPES.findIndex((option) => option.value === type);
  return (
    <fieldset>
      <legend className="mb-2 font-medium">Loại</legend>
      <div className="relative grid h-12 grid-cols-2 rounded-full bg-[var(--dash-track)] p-1">
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-[transform,background-color] duration-300 ease-lm ${
            type === "EXPENSE" ? "bg-lm-sky" : "bg-lm-mint"
          }`}
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {TYPES.map((option) => (
          <label
            key={option.value}
            className="relative z-10 flex cursor-pointer items-center justify-center rounded-full font-bold text-[var(--dash-muted)] transition-colors duration-300 has-checked:text-lm-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lm-deep"
          >
            <input
              type="radio"
              name="type"
              value={option.value}
              checked={type === option.value}
              onChange={() => setType(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddCategoryForm() {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    createCategoryAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form
      // Remount after a save so the inputs clear.
      key={state.savedAt ?? "initial"}
      action={formAction}
      aria-label="Thêm danh mục"
      className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start"
      noValidate
    >
      <BrandField
        name="name"
        label="Tên danh mục"
        required
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        placeholder="vd: Cà phê, Tiền điện"
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <TypeSwitch defaultValue={state.values?.type ?? "EXPENSE"} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <IconPicker name="icon" defaultValue={state.values?.icon} />
        <FieldMessages id="new-icon" error={errors.icon} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`${brandPrimaryButton} justify-self-start sm:col-span-2`}
      >
        {pending ? <Spinner /> : null}
        {pending ? "Đang thêm…" : "Thêm danh mục"}
      </button>
    </form>
  );
}

export function CategoryRow({ category }: { category: CategoryDto }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-col border-t border-[var(--dash-border)] first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-full text-xl ${
            category.archived
              ? "bg-[var(--dash-track)] grayscale"
              : category.type === "INCOME"
                ? "bg-lm-mint dark:bg-[#0f828c]/45"
                : "bg-lm-aqua/60 dark:bg-[#065084]/45"
          }`}
        >
          {category.icon ?? "•"}
        </span>
        <p
          className={`min-w-0 flex-1 truncate font-medium ${category.archived ? "text-[var(--dash-muted)]" : ""}`}
        >
          {category.icon ? <span className="sr-only">{category.icon} </span> : null}
          {category.name}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={`${brandSecondaryButton} h-9 px-3 text-sm`}
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Đóng" : "Sửa"}
          </button>
          <form
            action={
              category.archived
                ? restoreCategoryAction.bind(null, category.id)
                : archiveCategoryAction.bind(null, category.id)
            }
          >
            <button type="submit" className={`${brandSecondaryButton} h-9 px-3 text-sm`}>
              {category.archived ? "Khôi phục" : "Lưu trữ"}
            </button>
          </form>
        </div>
      </div>
      {editing ? <EditForm category={category} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}

function EditForm({ category, onDone }: { category: CategoryDto; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    async (previous: CategoryFormState, formData: FormData) => {
      const next = await renameCategoryAction(category.id, previous, formData);
      if (next.savedAt) {
        onDone();
      }
      return next;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form
      action={formAction}
      className="grid animate-lm-rise gap-4 border-t border-dashed border-[var(--dash-border)] px-4 py-4 [animation-duration:240ms] sm:grid-cols-2 sm:px-5"
      noValidate
    >
      <BrandField
        name="name"
        id={`name-${category.id}`}
        label={`Tên mới cho ${category.name}`}
        required
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        defaultValue={state.values?.name ?? category.name}
        error={errors.name}
      />
      <IconPicker name="icon" defaultValue={state.values?.icon ?? category.icon} />
      <button
        type="submit"
        disabled={pending}
        className={`${brandPrimaryButton} h-10 justify-self-start sm:col-span-2`}
      >
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
