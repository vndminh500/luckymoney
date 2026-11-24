"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { formatVnd } from "@/lib/money";
import { requireUserId } from "@/server/auth/session";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { addEntry, createJar, deleteEntry, deleteJar, updateJar } from "@/server/savings/service";

export type SavingsFormState = {
  /** First message per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, to refill the form after an error. */
  values?: Record<string, string>;
  /** Changes on every successful save so a form can reset. */
  savedAt?: number;
  /** What was just saved, for the success message. */
  message?: string;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Runs a save and turns expected errors into form state: validation errors
 * per field, a duplicate jar name on the name field. Another user's jar
 * renders the 404 page.
 */
async function saveWith(
  values: Record<string, string>,
  save: () => Promise<string>,
): Promise<SavingsFormState> {
  let message: string;
  try {
    message = await save();
  } catch (error) {
    if (error instanceof ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const { field, message: text } of error.details) {
        fieldErrors[field] ??= text;
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
  return { savedAt: Date.now(), message };
}

export async function createJarAction(
  _previous: SavingsFormState,
  formData: FormData,
): Promise<SavingsFormState> {
  const userId = await requireUserId();
  const values = { name: text(formData, "name"), icon: text(formData, "icon") };
  return saveWith(values, async () => {
    const jar = await createJar(userId, values);
    return `Đã tạo hũ “${jar.name}”.`;
  });
}

export async function updateJarAction(
  id: string,
  _previous: SavingsFormState,
  formData: FormData,
): Promise<SavingsFormState> {
  const userId = await requireUserId();
  const values = { name: text(formData, "name"), icon: text(formData, "icon") };
  return saveWith(values, async () => {
    await updateJar(userId, id, values);
    return "Đã lưu thay đổi.";
  });
}

export async function addEntryAction(
  jarId: string,
  _previous: SavingsFormState,
  formData: FormData,
): Promise<SavingsFormState> {
  const userId = await requireUserId();
  const values = {
    kind: text(formData, "kind"),
    amount: text(formData, "amount"),
    occurredOn: text(formData, "occurredOn"),
    note: text(formData, "note"),
  };
  return saveWith(values, async () => {
    const entry = await addEntry(userId, jarId, values);
    const amount = formatVnd(entry.amount);
    return entry.kind === "DEPOSIT" ? `Đã nạp ${amount} vào hũ.` : `Đã rút ${amount} khỏi hũ.`;
  });
}

export type UndoEntryState = { error?: string };

/** Undoes a deposit or withdrawal; a deposit already spent says why it cannot. */
export async function deleteEntryAction(jarId: string, entryId: string): Promise<UndoEntryState> {
  const userId = await requireUserId();
  try {
    await deleteEntry(userId, jarId, entryId);
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

export async function deleteJarAction(id: string): Promise<void> {
  const userId = await requireUserId();
  try {
    await deleteJar(userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  redirect("/savings");
}
