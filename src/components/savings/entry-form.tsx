"use client";

import { useActionState, useState } from "react";

import { addEntryAction, type SavingsFormState } from "@/app/(app)/savings/actions";
import { SavedNote } from "@/components/account/profile-form";
import {
  BrandAlert,
  BrandField,
  brandPrimaryButton,
  FieldMessages,
  Spinner,
} from "@/components/ui/brand-form";
import { DatePicker } from "@/components/ui/date-picker";

type Kind = "DEPOSIT" | "WITHDRAW";

const KINDS: { value: Kind; label: string }[] = [
  { value: "DEPOSIT", label: "Nạp tiền" },
  { value: "WITHDRAW", label: "Rút tiền" },
];

type Props = { jarId: string; today: string; balance: string; canWithdraw: boolean };

/** Put money into the jar or take some out; says whether it worked. */
export function EntryForm({ jarId, today, balance, canWithdraw }: Props) {
  const [state, formAction, pending] = useActionState<SavingsFormState, FormData>(
    addEntryAction.bind(null, jarId),
    {},
  );
  const [kind, setKind] = useState<Kind>(
    state.values?.kind === "WITHDRAW" && canWithdraw ? "WITHDRAW" : "DEPOSIT",
  );
  const errors = state.fieldErrors ?? {};
  const failed = Object.keys(errors).length > 0;

  return (
    <form
      key={state.savedAt ?? "initial"}
      action={formAction}
      aria-label="Nạp hoặc rút"
      className="flex flex-col gap-4"
      noValidate
    >
      {state.message ? <SavedNote savedAt={state.savedAt}>{state.message}</SavedNote> : null}
      {failed ? <BrandAlert>Chưa lưu được. Xem lỗi ở ô được đánh dấu bên dưới.</BrandAlert> : null}

      <fieldset>
        <legend className="sr-only">Nạp hay rút</legend>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--dash-track)] p-1">
          {KINDS.map((option) => {
            const disabled = option.value === "WITHDRAW" && !canWithdraw;
            const active = kind === option.value;
            return (
              <label
                key={option.value}
                className={`rounded-xl px-4 py-2.5 text-center font-bold transition-[background-color,color,box-shadow] duration-200 ease-lm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lm-deep ${
                  disabled
                    ? "cursor-not-allowed text-[var(--dash-muted)]/50"
                    : active
                      ? option.value === "DEPOSIT"
                        ? "cursor-pointer bg-[var(--dash-surface)] text-emerald-700 shadow-sm dark:text-emerald-300"
                        : "cursor-pointer bg-[var(--dash-surface)] text-[#c2531f] shadow-sm dark:text-[#f0915f]"
                      : "cursor-pointer text-[var(--dash-muted)] hover:text-[var(--dash-text)]"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={option.value}
                  checked={active}
                  disabled={disabled}
                  onChange={() => setKind(option.value)}
                  className="sr-only"
                />
                {option.value === "DEPOSIT" ? "+ " : "− "}
                {option.label}
              </label>
            );
          })}
        </div>
        <FieldMessages
          id="entry-kind"
          hint={canWithdraw ? undefined : "Hũ đang trống, chưa rút được."}
          error={errors.kind}
        />
      </fieldset>

      <BrandField
        name="amount"
        label="Số tiền"
        inputMode="numeric"
        variant="large"
        defaultValue={state.values?.amount}
        hint={kind === "WITHDRAW" ? `Số dư hiện có: ${balance}` : undefined}
        error={errors.amount}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          name="occurredOn"
          label="Ngày"
          defaultValue={state.values?.occurredOn || today}
          today={today}
          shortcuts="recent"
          error={errors.occurredOn}
          required
        />
        <BrandField
          name="note"
          label="Ghi chú"
          defaultValue={state.values?.note}
          error={errors.note}
        />
      </div>
      <button type="submit" disabled={pending} className={`${brandPrimaryButton} self-start`}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : kind === "DEPOSIT" ? "Nạp vào hũ" : "Rút khỏi hũ"}
      </button>
    </form>
  );
}
