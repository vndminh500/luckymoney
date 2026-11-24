"use server";

import { refresh } from "next/cache";
import { notFound } from "next/navigation";

import { requireUserId } from "@/server/auth/session";
import { deleteBudget, upsertBudgetFromForm } from "@/server/budgets/service";
import { NotFoundError, ValidationError } from "@/server/errors";

export type BudgetFormState = {
  /** Messages per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, to refill the form after an error. */
  values?: { categoryId: string; amount: string };
  /** Changes on every successful save so the form can reset. */
  savedAt?: number;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Sets the limit of a category for the month (creates or updates it). */
export async function saveBudgetAction(
  _previous: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const userId = await requireUserId();
  const values = { categoryId: text(formData, "categoryId"), amount: text(formData, "amount") };
  try {
    await upsertBudgetFromForm(userId, { ...values, month: text(formData, "month") });
  } catch (error) {
    if (error instanceof ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const { field, message } of error.details) {
        fieldErrors[field] ??= message;
      }
      return { fieldErrors, values };
    }
    throw error;
  }
  refresh();
  return { savedAt: Date.now() };
}

export async function deleteBudgetAction(id: string): Promise<void> {
  const userId = await requireUserId();
  try {
    await deleteBudget(userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  refresh();
}
