"use client";

import { useActionState, useEffect, useRef } from "react";

import { addPaymentAction, type DebtFormState } from "@/app/(app)/debts/actions";
import { BrandField, brandPrimaryButton, Spinner } from "@/components/ui/brand-form";

type Props = { debtId: string; suggested: number; today: string; payLabel: string };

/** Records a repayment; the amount starts at what is left on the next installment. */
export function PaymentForm({ debtId, suggested, today, payLabel }: Props) {
  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    addPaymentAction.bind(null, debtId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-label={payLabel}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <BrandField
          name="amount"
          label="Số tiền"
          inputMode="numeric"
          defaultValue={String(suggested)}
          key={`amount-${suggested}-${state.savedAt ?? 0}`}
          error={errors.amount}
          required
        />
        <BrandField
          name="paidOn"
          label="Ngày trả"
          type="date"
          defaultValue={today}
          error={errors.paidOn}
          required
        />
      </div>
      <BrandField name="note" label="Ghi chú" placeholder="vd: Chuyển khoản" error={errors.note} />
      <button type="submit" disabled={pending} className={brandPrimaryButton}>
        {pending ? <Spinner /> : null}
        {pending ? "Đang lưu…" : payLabel}
      </button>
    </form>
  );
}
