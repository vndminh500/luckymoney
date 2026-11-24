"use server";

import { notFound, redirect } from "next/navigation";

import { requireUserId } from "@/server/auth/session";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  createTransactionFromForm,
  deleteTransaction,
  updateTransactionFromForm,
} from "@/server/transactions/service";

export type TransactionFormValues = {
  type: string;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
};

export type TransactionFormState = {
  /** Messages per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, to refill the form after an error. */
  values?: TransactionFormValues;
  /** Set after a successful save; changes on every save so the form can reset. */
  savedId?: string;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function readValues(formData: FormData): TransactionFormValues {
  return {
    type: text(formData, "type"),
    amount: text(formData, "amount"),
    categoryId: text(formData, "categoryId"),
    date: text(formData, "date"),
    note: text(formData, "note"),
  };
}

/** First message per field, keyed by input name. */
function toFieldErrors(error: ValidationError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of error.details) {
    fieldErrors[field] ??= message;
  }
  return fieldErrors;
}

/** The list of a month ("YYYY-MM"), or the current month for anything else. */
function listHref(month: string): string {
  return /^\d{4}-\d{2}$/.test(month) ? `/transactions?month=${month}` : "/transactions";
}

export async function createTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const userId = await requireUserId();
  const values = readValues(formData);
  try {
    const transaction = await createTransactionFromForm(userId, values);
    // Keep type and date so several transactions of the same day are quick to enter.
    return { savedId: transaction.id, values: { ...values, amount: "", categoryId: "", note: "" } };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error), values };
    }
    throw error;
  }
}

/** Saves the edit form, then shows the list of the transaction's month. */
export async function updateTransactionAction(
  id: string,
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const userId = await requireUserId();
  const values = readValues(formData);
  try {
    await updateTransactionFromForm(userId, id, values);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error), values };
    }
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  redirect(listHref(values.date.slice(0, 7)));
}

/** Soft-deletes, then returns to the list of the month the user came from. */
export async function deleteTransactionAction(id: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  try {
    await deleteTransaction(userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  redirect(listHref(text(formData, "month")));
}
