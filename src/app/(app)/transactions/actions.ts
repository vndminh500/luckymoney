"use server";

import { requireUserId } from "@/server/auth/session";
import { ValidationError } from "@/server/errors";
import { createTransactionFromForm } from "@/server/transactions/service";

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

export async function createTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const userId = await requireUserId();
  const values: TransactionFormValues = {
    type: text(formData, "type"),
    amount: text(formData, "amount"),
    categoryId: text(formData, "categoryId"),
    date: text(formData, "date"),
    note: text(formData, "note"),
  };
  try {
    const transaction = await createTransactionFromForm(userId, values);
    // Keep type and date so several transactions of the same day are quick to enter.
    return { savedId: transaction.id, values: { ...values, amount: "", categoryId: "", note: "" } };
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
}
