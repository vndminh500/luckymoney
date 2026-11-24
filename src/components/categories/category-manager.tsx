"use client";

import { useActionState, useState } from "react";

import {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  restoreCategoryAction,
  type CategoryFormState,
} from "@/app/(app)/categories/actions";
import { Field, SubmitButton } from "@/components/ui/form";
import { CATEGORY_ICON_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH } from "@/lib/schemas/category";
import type { CategoryDto } from "@/server/categories/service";

const secondaryButton =
  "h-9 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-600 dark:hover:bg-zinc-800";

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
      className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[1fr_8rem_6rem] sm:items-start dark:border-zinc-800"
      noValidate
    >
      <Field
        name="name"
        label="Tên danh mục"
        required
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-category-type" className="text-sm font-medium">
          Loại
        </label>
        <select
          id="new-category-type"
          name="type"
          defaultValue={state.values?.type || "EXPENSE"}
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="EXPENSE">Chi</option>
          <option value="INCOME">Thu</option>
        </select>
      </div>
      <Field
        name="icon"
        id="new-category-icon"
        label="Biểu tượng"
        maxLength={CATEGORY_ICON_MAX_LENGTH}
        placeholder="☕"
        defaultValue={state.values?.icon}
        error={errors.icon}
      />
      <div className="sm:col-span-3">
        <SubmitButton pending={pending}>{pending ? "Đang thêm…" : "Thêm danh mục"}</SubmitButton>
      </div>
    </form>
  );
}

export function CategoryRow({ category }: { category: CategoryDto }) {
  const [editing, setEditing] = useState(false);
  const label = `${category.icon ? `${category.icon} ` : ""}${category.name}`;

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{label}</p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={secondaryButton}
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Đóng" : "Đổi tên"}
          </button>
          <form
            action={
              category.archived
                ? restoreCategoryAction.bind(null, category.id)
                : archiveCategoryAction.bind(null, category.id)
            }
          >
            <button type="submit" className={secondaryButton}>
              {category.archived ? "Khôi phục" : "Lưu trữ"}
            </button>
          </form>
        </div>
      </div>
      {editing ? <RenameForm category={category} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}

function RenameForm({ category, onDone }: { category: CategoryDto; onDone: () => void }) {
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
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_6rem]" noValidate>
      <Field
        name="name"
        id={`name-${category.id}`}
        label={`Tên mới cho ${category.name}`}
        required
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        defaultValue={state.values?.name ?? category.name}
        error={errors.name}
      />
      <Field
        name="icon"
        id={`icon-${category.id}`}
        label="Biểu tượng"
        maxLength={CATEGORY_ICON_MAX_LENGTH}
        defaultValue={state.values?.icon ?? category.icon ?? ""}
        error={errors.icon}
      />
      <div className="sm:col-span-2">
        <SubmitButton pending={pending}>{pending ? "Đang lưu…" : "Lưu tên"}</SubmitButton>
      </div>
    </form>
  );
}
