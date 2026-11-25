"use client";

import { useActionState } from "react";

import { changePasswordAction, type AccountFormState } from "@/app/(app)/account/actions";
import { SavedNote } from "@/components/account/profile-form";
import { BrandField, brandPrimaryButton, Spinner } from "@/components/ui/brand-form";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

/** Change the password; the current one must be confirmed. */
export function PasswordForm() {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    changePasswordAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    // A new key after each save clears the password inputs.
    <form
      key={state.savedAt ?? "initial"}
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
    >
      <SavedNote savedAt={state.savedAt}>Đã đổi mật khẩu.</SavedNote>
      <BrandField
        name="currentPassword"
        type="password"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <BrandField
        name="newPassword"
        type="password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`}
        error={errors.newPassword}
      />
      <BrandField
        name="confirmPassword"
        type="password"
        label="Nhập lại mật khẩu mới"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
