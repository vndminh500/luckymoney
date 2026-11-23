"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { registerUser } from "@/server/auth/users";
import { ConflictError, ValidationError } from "@/server/errors";

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
    await registerUser({ ...values, password });
  } catch (error) {
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

export async function googleSignInAction(formData: FormData): Promise<void> {
  // Redirects to Google, then back to callbackUrl (validated to stay on this site).
  await signIn("google", { redirectTo: safeRedirectPath(formData.get("callbackUrl")) });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
