"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  RESET_TICKET_TTL_MS,
  requestPasswordReset,
  resetPassword,
  verifyResetCode,
} from "@/server/auth/password-reset";
import { RESET_TICKET_COOKIE } from "@/server/auth/reset-cookie";
import { sendInBackground } from "@/server/email/background";
import { sendEmail } from "@/server/email/mailer";
import { ValidationError } from "@/server/errors";

export type ForgotPasswordState = {
  step: "email" | "code";
  email?: string;
  /** Message for the whole form (e.g. wrong code). */
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Neutral confirmation shown on the code step. */
  notice?: string;
};

export type ResetPasswordState = {
  done?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SENT_NOTICE = "Nếu email đã đăng ký, mã đã được gửi.";
const WRONG_CODE = "Mã không đúng hoặc đã hết hạn.";
const EXPIRED = "Phiên đặt lại đã hết hạn. Vui lòng yêu cầu mã mới.";

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function fieldErrorsOf(error: ValidationError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of error.details) {
    fieldErrors[field] ??= message;
  }
  return fieldErrors;
}

/** Step 1 (and "Gửi lại mã"): always the same answer, whoever the email belongs to. */
export async function requestResetCodeAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = text(formData, "email").trim();
  try {
    // Sent after the response: SMTP speed must not change or delay the answer.
    await requestPasswordReset({ email }, new Date(), sendInBackground(sendEmail, after));
  } catch (error) {
    if (error instanceof ValidationError) {
      return { step: "email", email, fieldErrors: fieldErrorsOf(error) };
    }
    throw error;
  }
  return { step: "code", email, notice: SENT_NOTICE };
}

/** Step 2: a right code puts a one-time ticket in a cookie and opens the reset page. */
export async function verifyResetCodeAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = text(formData, "email").trim();
  let ticket: string | null;
  try {
    ticket = await verifyResetCode({ email, code: text(formData, "code") }, new Date());
  } catch (error) {
    if (error instanceof ValidationError) {
      return { step: "code", email, fieldErrors: fieldErrorsOf(error) };
    }
    throw error;
  }
  if (!ticket) {
    return { step: "code", email, error: WRONG_CODE };
  }
  (await cookies()).set(RESET_TICKET_COOKIE, ticket, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/reset-password",
    maxAge: RESET_TICKET_TTL_MS / 1000,
  });
  redirect("/reset-password");
}

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const ticket = (await cookies()).get(RESET_TICKET_COOKIE)?.value ?? "";
  const input = {
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  };
  let changed: boolean;
  try {
    changed = await resetPassword(ticket, input, new Date());
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: fieldErrorsOf(error) };
    }
    throw error;
  }
  if (!changed) {
    return { error: EXPIRED };
  }
  // The cookie is left to expire: the ticket is already gone from the database,
  // and changing a cookie here would re-render the page and drop the success dialog.
  return { done: true };
}
