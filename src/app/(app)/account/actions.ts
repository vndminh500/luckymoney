"use server";

import { refresh } from "next/cache";

import { changePassword, removeAvatar, setAvatar, updateProfile } from "@/server/account/service";
import { requireUserId } from "@/server/auth/session";
import { ConflictError, ValidationError } from "@/server/errors";

export type AccountFormState = {
  /** Messages per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, to refill the form after an error (never passwords). */
  values?: Record<string, string>;
  /** Changes on every successful save, to show the confirmation again. */
  savedAt?: number;
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function toFieldErrors(error: ValidationError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of error.details) {
    fieldErrors[field] ??= message;
  }
  return fieldErrors;
}

export async function updateProfileAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();
  const values = {
    name: text(formData, "name"),
    username: text(formData, "username"),
    birthDate: text(formData, "birthDate"),
  };
  try {
    await updateProfile(userId, values);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error), values };
    }
    if (error instanceof ConflictError) {
      return { fieldErrors: { username: error.message }, values };
    }
    throw error;
  }
  refresh();
  return { savedAt: Date.now(), values };
}

export async function changePasswordAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();
  try {
    await changePassword(userId, {
      currentPassword: text(formData, "currentPassword") || undefined,
      newPassword: text(formData, "newPassword"),
      confirmPassword: text(formData, "confirmPassword"),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error) };
    }
    throw error;
  }
  refresh();
  return { savedAt: Date.now() };
}

/** Receives the avatar already cropped and resized by the browser. */
export async function uploadAvatarAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();
  const file = formData.get("avatar");
  if (!(file instanceof Blob) || file.size === 0) {
    return { fieldErrors: { avatar: "Vui lòng chọn một ảnh." } };
  }
  try {
    await setAvatar(userId, new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error) };
    }
    throw error;
  }
  refresh();
  return { savedAt: Date.now() };
}

export async function removeAvatarAction(): Promise<void> {
  const userId = await requireUserId();
  await removeAvatar(userId);
  refresh();
}
