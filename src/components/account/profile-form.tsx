"use client";

import { useActionState } from "react";

import { updateProfileAction, type AccountFormState } from "@/app/(app)/account/actions";
import { BrandField, brandPrimaryButton, Spinner } from "@/components/ui/brand-form";
import { BIRTH_DATE_MIN, NAME_MAX_LENGTH } from "@/lib/schemas/account";

type Props = {
  name: string | null;
  username: string | null;
  birthDate: string | null;
  email: string;
  googleLinked: boolean;
  today: string;
};

export function SavedNote({ savedAt, children }: { savedAt?: number; children: string }) {
  if (!savedAt) return null;
  return (
    <p
      key={savedAt}
      role="status"
      className="animate-lm-rise rounded-xl border border-lm-mint bg-lm-lime/60 px-4 py-3 text-lm-ink [animation-duration:320ms] dark:border-[#0f828c] dark:bg-[#0f828c]/25 dark:text-[#eaf4f3]"
    >
      {children}
    </p>
  );
}

export function ProfileForm({ name, username, birthDate, email, googleLinked, today }: Props) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateProfileAction,
    {},
  );
  const values = state.values;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <SavedNote savedAt={state.savedAt}>Đã lưu thông tin cá nhân.</SavedNote>
      <BrandField
        name="name"
        label="Họ tên"
        autoComplete="name"
        maxLength={NAME_MAX_LENGTH}
        defaultValue={values?.name ?? name ?? ""}
        error={errors.name}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <BrandField
          name="username"
          label="Tên đăng nhập"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="vd: minh.nguyen"
          defaultValue={values?.username ?? username ?? ""}
          hint="Tên hiển thị duy nhất. Bạn vẫn đăng nhập bằng email."
          error={errors.username}
        />
        <BrandField
          name="birthDate"
          type="date"
          label="Ngày sinh"
          min={BIRTH_DATE_MIN}
          max={today}
          defaultValue={values?.birthDate ?? birthDate ?? ""}
          error={errors.birthDate}
        />
      </div>
      <BrandField
        name="email"
        type="email"
        label="Email"
        value={email}
        readOnly
        aria-readonly="true"
        hint={
          googleLinked
            ? "Email dùng để đăng nhập, đã liên kết với Google. Chưa thể đổi email."
            : "Email dùng để đăng nhập. Chưa thể đổi email."
        }
      />
      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
