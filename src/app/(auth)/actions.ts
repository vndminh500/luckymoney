"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";

import { RATE_LIMITED_SIGN_IN, signIn, signOut } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { registerUser } from "@/server/auth/users";
import { ConflictError, ValidationError } from "@/server/errors";
import { clientIp, enforceRateLimit, RATE_LIMITS, RateLimitedError } from "@/server/rate-limit";

const TOO_MANY_SIGN_INS = "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.";

export type AuthFormState = {
  /** Message for the whole form (e.g. wrong email or password). */
  error?: string;
  /** Messages per field, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Submitted values to refill the form (never the password). */
  values?: { email?: string; name?: string };
};

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email");
  try {
    // On success signIn throws Next.js' redirect, which must propagate.
    await signIn("credentials", {
      email,
      password: text(formData, "password"),
      redirectTo: safeRedirectPath(formData.get("callbackUrl")),
    });
    return {};
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === RATE_LIMITED_SIGN_IN) {
      return { error: TOO_MANY_SIGN_INS, values: { email } };
    }
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      return { error: "Email hoặc mật khẩu không đúng.", values: { email } };
    }
    throw error;
  }
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: text(formData, "email"), name: text(formData, "name") };
  const password = text(formData, "password");
  try {
    await enforceRateLimit(RATE_LIMITS.registerPerIp, clientIp(await headers()));
    await registerUser({ ...values, password });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return { error: error.message, values };
    }
    if (error instanceof ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const { field, message } of error.details) {
        fieldErrors[field] ??= message;
      }
      return { fieldErrors, values };
    }
    if (error instanceof ConflictError) {
      return { fieldErrors: { email: error.message }, values };
    }
    throw error;
  }
  // Sign the new user in right away; throws a redirect to the home page.
  await signIn("credentials", { email: values.email, password, redirectTo: "/" });
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
