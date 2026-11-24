"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme";
import { requireUserId } from "@/server/auth/session";
import { ValidationError } from "@/server/errors";
import {
  updateDisplayPreferences,
  updateNotificationPreferences,
  updateTheme,
} from "@/server/settings/service";

export type SettingsFormState = {
  fieldErrors?: Record<string, string>;
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

/** Cài đặt > Tùy chỉnh tài chính. */
export async function saveDisplayAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  try {
    await updateDisplayPreferences(userId, {
      amountFormat: text(formData, "amountFormat"),
      dateFormat: text(formData, "dateFormat"),
      weekStart: text(formData, "weekStart"),
      timeZone: text(formData, "timeZone"),
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

/** Cài đặt > Giao diện: saved to the account and mirrored in a cookie for the next first paint. */
export async function saveThemeAction(theme: string): Promise<SettingsFormState> {
  const userId = await requireUserId();
  try {
    await updateTheme(userId, theme);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: toFieldErrors(error) };
    }
    throw error;
  }
  (await cookies()).set(THEME_COOKIE, theme.toLowerCase(), {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Read by the inline script in the root layout, so not httpOnly; it holds no secret.
    httpOnly: false,
  });
  return { savedAt: Date.now() };
}

/** Cài đặt > Thông báo. */
export async function saveNotificationsAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  await updateNotificationPreferences(userId, {
    notifyBudgetWarning: formData.get("notifyBudgetWarning") === "on",
    notifyBudgetOver: formData.get("notifyBudgetOver") === "on",
  });
  refresh();
  return { savedAt: Date.now() };
}
