"use client";

import { useActionState } from "react";

import {
  createJarAction,
  updateJarAction,
  type SavingsFormState,
} from "@/app/(app)/savings/actions";
import { SavedNote } from "@/components/account/profile-form";
import { IconPicker } from "@/components/categories/icon-picker";
import {
  BrandAlert,
  BrandField,
  brandPrimaryButton,
  brandSecondaryButton,
  FieldMessages,
  Spinner,
} from "@/components/ui/brand-form";
import { JAR_NAME_MAX_LENGTH } from "@/lib/schemas/savings";

/** New jar: a name and an optional icon; says whether it worked. */
export function AddJarForm() {
  const [state, formAction, pending] = useActionState<SavingsFormState, FormData>(
    createJarAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const failed = Object.keys(errors).length > 0;
  return (
    <form
      // Remount after a save so the inputs clear.
      key={state.savedAt ?? "initial"}
      action={formAction}
      aria-label="Tạo hũ mới"
      className="flex flex-col gap-4"
      noValidate
    >
      {state.message ? <SavedNote savedAt={state.savedAt}>{state.message}</SavedNote> : null}
      {failed ? (
        <BrandAlert>Chưa tạo được hũ. Xem lỗi ở ô được đánh dấu bên dưới.</BrandAlert>
      ) : null}
      <BrandField
        name="name"
        label="Tên hũ"
        required
        maxLength={JAR_NAME_MAX_LENGTH}
        placeholder="vd: Quỹ khẩn cấp, Du lịch Đà Lạt"
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <div className="flex flex-col gap-2">
        <IconPicker name="icon" defaultValue={state.values?.icon} />
        <FieldMessages id="jar-icon" error={errors.icon} />
      </div>
      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang tạo…" : "Tạo hũ"}
      </button>
    </form>
  );
}

type EditProps = { jar: { id: string; name: string; icon: string | null }; onDone: () => void };

/** Rename a jar or change its icon. */
export function EditJarForm({ jar, onDone }: EditProps) {
  const [state, formAction, pending] = useActionState<SavingsFormState, FormData>(
    async (previous, formData) => {
      const next = await updateJarAction(jar.id, previous, formData);
      if (next.savedAt) onDone();
      return next;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form
      action={formAction}
      aria-label={`Sửa hũ ${jar.name}`}
      className="flex flex-col gap-4 border-t border-[var(--dash-border)] pt-4"
      noValidate
    >
      <BrandField
        name="name"
        label="Tên hũ"
        required
        maxLength={JAR_NAME_MAX_LENGTH}
        defaultValue={state.values?.name ?? jar.name}
        error={errors.name}
      />
      <IconPicker name="icon" defaultValue={state.values?.icon ?? jar.icon} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={brandPrimaryButton}>
          {pending ? <Spinner /> : null}
          {pending ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
        <button type="button" onClick={onDone} className={`${brandSecondaryButton} h-12`}>
          Hủy
        </button>
      </div>
    </form>
  );
}
