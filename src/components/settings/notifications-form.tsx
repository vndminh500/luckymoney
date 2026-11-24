"use client";

import { useActionState } from "react";

import { saveNotificationsAction, type SettingsFormState } from "@/app/(app)/settings/actions";
import { SavedNote } from "@/components/account/profile-form";
import { brandPrimaryButton, Spinner } from "@/components/ui/brand-form";

function Switch({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--dash-border)] px-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-[var(--dash-muted)]">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      {/* The visual switch; the real control is the checkbox above (role="switch"). */}
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-[var(--dash-track)] ring-1 ring-[var(--dash-border)] transition-colors duration-200 ease-lm peer-checked:bg-lm-sky peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lm-deep after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 after:ease-lm peer-checked:after:translate-x-5"
      />
    </label>
  );
}

type Props = { notifyBudgetWarning: boolean; notifyBudgetOver: boolean };

/** Cài đặt > Thông báo: in-app budget alerts on the dashboard. */
export function NotificationsForm({ notifyBudgetWarning, notifyBudgetOver }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveNotificationsAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SavedNote savedAt={state.savedAt}>Đã lưu thông báo.</SavedNote>
      <Switch
        name="notifyBudgetWarning"
        label="Sắp chạm hạn mức"
        description="Báo trên trang Tổng quan khi một danh mục dùng từ 80% ngân sách tháng."
        defaultChecked={notifyBudgetWarning}
      />
      <Switch
        name="notifyBudgetOver"
        label="Vượt hạn mức"
        description="Báo trên trang Tổng quan khi một danh mục chi vượt ngân sách tháng."
        defaultChecked={notifyBudgetOver}
      />
      <p className="text-sm text-[var(--dash-muted)]">
        Thông báo hiện trong ứng dụng. Ứng dụng chưa gửi email hay thông báo đẩy.
      </p>
      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : "Lưu thông báo"}
      </button>
    </form>
  );
}
