"use server";

import { refresh } from "next/cache";
import { notFound } from "next/navigation";

import { requireUserId } from "@/server/auth/session";
import {
  archiveCategory,
  createCategory,
  restoreCategory,
  updateCategory,
} from "@/server/categories/service";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export type CategoryFormState = {
  /** Messages per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, to refill the form after an error. */
  values?: Record<string, string>;
  /** Changes on every successful save so the form can reset. */
  savedAt?: number;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Runs a create/rename and turns expected errors into form state. A duplicate
 * name is shown on the name field. Unknown or foreign ids render the 404 page.
 */
async function saveWith(
  values: Record<string, string>,
  save: () => Promise<unknown>,
): Promise<CategoryFormState> {
  try {
    await save();
  } catch (error) {
    if (error instanceof ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const { field, message } of error.details) {
        fieldErrors[field] ??= message;
      }
      return { fieldErrors, values };
    }
    if (error instanceof ConflictError) {
      return { fieldErrors: { name: error.message }, values };
    }
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  refresh();
  return { savedAt: Date.now() };
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const userId = await requireUserId();
  const values = {
    name: text(formData, "name"),
    type: text(formData, "type"),
    icon: text(formData, "icon"),
  };
  return saveWith(values, () => createCategory(userId, values));
}

export async function renameCategoryAction(
  id: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const userId = await requireUserId();
  const values = { name: text(formData, "name"), icon: text(formData, "icon") };
  return saveWith(values, () => updateCategory(userId, id, values));
}

async function setArchived(id: string, archived: boolean): Promise<void> {
  const userId = await requireUserId();
  try {
    await (archived ? archiveCategory(userId, id) : restoreCategory(userId, id));
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  refresh();
}

export async function archiveCategoryAction(id: string): Promise<void> {
  await setArchived(id, true);
}

export async function restoreCategoryAction(id: string): Promise<void> {
  await setArchived(id, false);
}
