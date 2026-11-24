"use client";

import { useActionState } from "react";

import { saveDisplayAction, type SettingsFormState } from "@/app/(app)/settings/actions";
import { SavedNote } from "@/components/account/profile-form";
import { ChoiceGroup } from "@/components/settings/choice-group";
import { brandControl, brandPrimaryButton, Spinner } from "@/components/ui/brand-form";
import { formatDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Preferences } from "@/server/settings/service";

type Props = { preferences: Preferences; timeZones: string[]; today: string };

/** Cài đặt > Tùy chỉnh tài chính. Every choice shows an example in its own format. */
export function DisplayForm({ preferences, timeZones, today }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveDisplayAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-7" noValidate>
      <SavedNote savedAt={state.savedAt}>Đã lưu tùy chỉnh tài chính.</SavedNote>

      <div className="flex flex-col gap-2">
        <p className="font-medium">Tiền tệ</p>
        <p className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-track)] px-4 py-3">
          Đồng Việt Nam (VND)
          <span className="mt-0.5 block text-sm text-[var(--dash-muted)]">
            Hiện ứng dụng chỉ hỗ trợ VND. Số tiền luôn được lưu chính xác đến từng đồng.
          </span>
        </p>
      </div>

      <ChoiceGroup
        name="amountFormat"
        legend="Hiển thị số tiền"
        defaultValue={preferences.amountFormat}
        error={errors.amountFormat}
        hint="Kiểu rút gọn chỉ đổi cách hiển thị, không làm tròn số tiền đã lưu."
        choices={[
          { value: "SYMBOL", label: "Ký hiệu ₫", example: formatMoney(1_250_000, "SYMBOL") },
          { value: "DONG", label: "Chữ đ", example: formatMoney(1_250_000, "DONG") },
          { value: "SHORT", label: "Rút gọn", example: formatMoney(1_250_000, "SHORT") },
        ]}
      />

      <ChoiceGroup
        name="dateFormat"
        legend="Định dạng ngày"
        defaultValue={preferences.dateFormat}
        error={errors.dateFormat}
        choices={[
          { value: "DMY", label: "Ngày/tháng/năm", example: formatDateKey(today, "DMY") },
          { value: "ISO", label: "Năm-tháng-ngày", example: formatDateKey(today, "ISO") },
        ]}
      />

      <ChoiceGroup
        name="weekStart"
        legend="Ngày đầu tuần"
        defaultValue={preferences.weekStart}
        error={errors.weekStart}
        hint="Dùng cho thống kê theo tuần."
        choices={[
          { value: "MONDAY", label: "Thứ Hai" },
          { value: "SUNDAY", label: "Chủ Nhật" },
        ]}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="timeZone" className="font-medium">
          Múi giờ
        </label>
        <select
          id="timeZone"
          name="timeZone"
          defaultValue={preferences.timeZone}
          aria-invalid={errors.timeZone ? true : undefined}
          aria-describedby="timeZone-hint"
          className={brandControl}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p id="timeZone-hint" className="text-sm text-[var(--dash-muted)]">
          Quyết định một giao dịch thuộc ngày, tuần, tháng, năm nào.
        </p>
        {errors.timeZone ? (
          <p className="text-sm text-red-700 dark:text-red-400">{errors.timeZone}</p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : "Lưu tùy chỉnh"}
      </button>
    </form>
  );
}
