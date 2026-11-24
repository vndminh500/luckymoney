"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireUserId } from "@/server/auth/session";
import {
  addPayment,
  createDebt,
  deleteDebt,
  deletePayment,
  settleDebt,
  todayForUser,
  updateDebt,
} from "@/server/debts/service";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export type DebtFormState = {
  /** First message per field; every schedule problem is reported as "installments". */
  fieldErrors?: Record<string, string>;
  /** Changes on every successful save so a form can reset. */
  savedAt?: number;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function fieldErrorsOf(error: ValidationError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of error.details) {
    const key = field.startsWith("installments") ? "installments" : field;
    fieldErrors[key] ??= message;
  }
  return fieldErrors;
}

/** Expected errors become form state; another user's debt renders the 404 page. */
async function run(action: () => Promise<unknown>): Promise<DebtFormState | null> {
  try {
    await action();
    return null;
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: fieldErrorsOf(error) };
    }
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}

function debtInput(formData: FormData) {
  let installments: unknown = null;
  try {
    installments = JSON.parse(text(formData, "installments") || "null");
  } catch {
    // Left null: the schema reports a missing schedule.
  }
  return {
    direction: text(formData, "direction"),
    counterparty: text(formData, "counterparty"),
    principal: text(formData, "principal"),
    startDate: text(formData, "startDate"),
    note: text(formData, "note"),
    installments,
  };
}

/** Creates a debt (id null) or replaces one, then opens its page. */
export async function saveDebtAction(
  id: string | null,
  _previous: DebtFormState,
  formData: FormData,
): Promise<DebtFormState> {
  const userId = await requireUserId();
  const input = debtInput(formData);
  let savedId = id;
  const failed = await run(async () => {
    if (id) {
      await updateDebt(userId, id, input);
    } else {
      savedId = (await createDebt(userId, input)).id;
    }
  });
  if (failed) return failed;
  redirect(`/debts/${savedId}`);
}

export async function addPaymentAction(
  debtId: string,
  _previous: DebtFormState,
  formData: FormData,
): Promise<DebtFormState> {
  const userId = await requireUserId();
  const failed = await run(() =>
    addPayment(userId, debtId, {
      amount: text(formData, "amount"),
      paidOn: text(formData, "paidOn"),
      note: text(formData, "note"),
    }),
  );
  if (failed) return failed;
  refresh();
  return { savedAt: Date.now() };
}

export async function deletePaymentAction(debtId: string, paymentId: string): Promise<void> {
  const userId = await requireUserId();
  await run(() => deletePayment(userId, debtId, paymentId));
  refresh();
}

export async function deleteDebtAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await run(() => deleteDebt(userId, id));
  redirect("/debts");
}

export type SettleDebtState = { error?: string };

/** "Đã tất toán": one payment for everything left, dated today in the user's time zone. */
export async function settleDebtAction(id: string): Promise<SettleDebtState> {
  const userId = await requireUserId();
  try {
    await settleDebt(userId, id, await todayForUser(userId));
  } catch (error) {
    if (error instanceof ConflictError) {
      return { error: error.message };
    }
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  refresh();
  return {};
}
