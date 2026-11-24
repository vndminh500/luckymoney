"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { saveDebtAction, type DebtFormState } from "@/app/(app)/debts/actions";
import {
  BrandAlert,
  BrandField,
  brandControl,
  brandPrimaryButton,
  brandSecondaryButton,
  FieldMessages,
  Spinner,
} from "@/components/ui/brand-form";
import { DatePicker } from "@/components/ui/date-picker";
import { addMonthsToDateKey, splitEvenly } from "@/lib/debt";
import { formatVnd, parseVnd } from "@/lib/money";

type Direction = "I_OWE" | "THEY_OWE";
type Row = { key: number; dueDate: string; amount: string };

export type DebtFormValues = {
  direction: Direction;
  counterparty: string;
  principal: number;
  startDate: string;
  note: string | null;
  installments: { dueDate: string; amount: number }[];
};

type Props = {
  /** The debt being edited, or null for a new one. */
  debtId: string | null;
  initial: DebtFormValues | null;
  today: string;
};

const DIRECTIONS: { value: Direction; label: string; hint: string }[] = [
  { value: "I_OWE", label: "Tôi nợ", hint: "Tôi vay, tôi phải trả" },
  { value: "THEY_OWE", label: "Nợ tôi", hint: "Người khác vay tôi" },
];

let nextKey = 0;
const toRows = (items: { dueDate: string; amount: number }[]): Row[] =>
  items.map((item) => ({ key: nextKey++, dueDate: item.dueDate, amount: String(item.amount) }));

/**
 * A debt and its expected repayment schedule. "Chia đều" fills equal monthly
 * installments; every row stays editable. The running total shows at once
 * whether the schedule adds up to the amount (the server checks it again).
 */
export function DebtForm({ debtId, initial, today }: Props) {
  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    saveDebtAction.bind(null, debtId),
    {},
  );
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "I_OWE");
  const [principal, setPrincipal] = useState(initial ? String(initial.principal) : "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  // Controlled: React resets uncontrolled fields after every submission, errors included.
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [count, setCount] = useState(initial ? Math.max(initial.installments.length, 1) : 1);
  const [firstDue, setFirstDue] = useState(
    initial?.installments[0]?.dueDate ?? addMonthsToDateKey(today, 1),
  );
  const [rows, setRows] = useState<Row[]>(() => (initial ? toRows(initial.installments) : []));
  const errors = state.fieldErrors ?? {};

  const principalValue = parseVnd(principal);
  const total = rows.reduce((sum, row) => sum + (parseVnd(row.amount) ?? 0), 0);
  const difference = principalValue === null ? null : principalValue - total;
  const scheduleJson = useMemo(
    () => JSON.stringify(rows.map(({ dueDate, amount }) => ({ dueDate, amount }))),
    [rows],
  );

  const split = () => {
    if (principalValue === null || principalValue <= 0 || !firstDue) return;
    const safeCount = Math.min(Math.max(Math.trunc(count) || 1, 1), 120);
    setRows(toRows(splitEvenly(principalValue, safeCount, firstDue)));
  };
  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const addRow = () =>
    setRows((current) => {
      const last = current.at(-1)?.dueDate;
      const dueDate = last ? addMonthsToDateKey(last, 1) : firstDue;
      const left = difference !== null && difference > 0 ? String(difference) : "";
      return [...current, { key: nextKey++, dueDate, amount: left }];
    });

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-5 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Chiều nợ</legend>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--dash-track)] p-1">
            {DIRECTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col rounded-xl px-4 py-2.5 transition-[background-color,box-shadow] duration-200 ease-lm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lm-deep ${
                  direction === option.value
                    ? option.value === "I_OWE"
                      ? "bg-[var(--dash-surface)] shadow-sm ring-2 ring-[#eb6834]/70"
                      : "bg-[var(--dash-surface)] shadow-sm ring-2 ring-[#1baf7a]/70"
                    : "text-[var(--dash-muted)] hover:text-[var(--dash-text)]"
                }`}
              >
                <input
                  type="radio"
                  name="direction"
                  value={option.value}
                  checked={direction === option.value}
                  onChange={() => setDirection(option.value)}
                  className="sr-only"
                />
                <span className="font-bold">{option.label}</span>
                <span className="text-sm text-[var(--dash-muted)]">{option.hint}</span>
              </label>
            ))}
          </div>
          <FieldMessages id="direction" error={errors.direction} />
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <BrandField
            name="counterparty"
            label={direction === "I_OWE" ? "Người cho vay" : "Người vay"}
            placeholder="vd: Anh Hùng, Lan"
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            error={errors.counterparty}
            maxLength={80}
            autoComplete="off"
            required
          />
          <BrandField
            name="principal"
            label="Số tiền nợ"
            inputMode="numeric"
            placeholder="vd: 5tr, 500k"
            value={principal}
            onChange={(event) => setPrincipal(event.target.value)}
            hint={
              principalValue !== null && principalValue > 0 ? formatVnd(principalValue) : undefined
            }
            error={errors.principal}
            required
          />
          <DatePicker
            name="startDate"
            label="Ngày vay"
            value={startDate}
            onChange={setStartDate}
            today={today}
            shortcuts="recent"
            error={errors.startDate}
            required
          />
          <BrandField
            name="note"
            label="Ghi chú"
            placeholder="vd: Mượn sửa xe"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={errors.note}
            maxLength={500}
          />
        </div>
      </section>

      <section
        aria-labelledby="schedule-title"
        className="flex flex-col gap-4 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6"
      >
        <div>
          <h2 id="schedule-title" className="text-lg font-bold">
            Lịch trả dự kiến
          </h2>
          <p className="text-[var(--dash-muted)]">
            Chia đều theo tháng, rồi chỉnh từng kỳ nếu cần. Tổng các kỳ phải bằng số tiền nợ.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2">
            <span className="font-medium">Số kỳ</span>
            <input
              type="number"
              min={1}
              max={120}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className={`${brandControl} w-24`}
            />
          </label>
          <div className="w-48">
            <DatePicker
              label="Kỳ đầu tiên"
              value={firstDue}
              onChange={setFirstDue}
              today={today}
              required
            />
          </div>
          <button
            type="button"
            onClick={split}
            disabled={principalValue === null || principalValue <= 0}
            className={`${brandSecondaryButton} h-12 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Chia đều
          </button>
        </div>

        {rows.length > 0 ? (
          <ol aria-label="Các kỳ trả" className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 sm:grid-cols-[2rem_11rem_1fr_auto]"
              >
                <span className="text-sm font-medium text-[var(--dash-muted)] tabular-nums">
                  {index + 1}.
                </span>
                <div className="col-span-2 sm:col-span-1">
                  <DatePicker
                    ariaLabel={`Ngày trả kỳ ${index + 1}`}
                    value={row.dueDate}
                    onChange={(dueDate) => updateRow(row.key, { dueDate })}
                    today={today}
                    required
                  />
                </div>
                <input
                  inputMode="numeric"
                  aria-label={`Số tiền kỳ ${index + 1}`}
                  value={row.amount}
                  onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                  className={`${brandControl} col-start-2 tabular-nums sm:col-start-auto`}
                />
                <button
                  type="button"
                  aria-label={`Bỏ kỳ ${index + 1}`}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  className="grid size-10 place-items-center rounded-xl text-[var(--dash-muted)] transition-colors hover:bg-[var(--dash-track)] hover:text-red-700 focus-visible:outline-2 focus-visible:outline-lm-deep dark:hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--dash-border)] px-4 py-6 text-center text-[var(--dash-muted)]">
            Nhập số tiền rồi bấm “Chia đều”, hoặc thêm từng kỳ.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={addRow} className={brandSecondaryButton}>
            + Thêm kỳ
          </button>
          <p aria-live="polite" className="text-sm tabular-nums">
            Tổng lịch trả: <strong>{formatVnd(total)}</strong>
            {difference === null || rows.length === 0 ? null : difference === 0 ? (
              <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-400">
                ✓ Khớp số tiền nợ
              </span>
            ) : (
              <span className="ml-2 font-medium text-amber-800 dark:text-amber-300">
                {difference > 0
                  ? `Còn thiếu ${formatVnd(difference)}`
                  : `Dư ${formatVnd(-difference)}`}
              </span>
            )}
          </p>
        </div>
        <input type="hidden" name="installments" value={scheduleJson} />
        {errors.installments ? <BrandAlert>{errors.installments}</BrandAlert> : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={brandPrimaryButton}>
          {pending ? <Spinner /> : null}
          {pending ? "Đang lưu…" : debtId ? "Lưu thay đổi" : "Thêm khoản nợ"}
        </button>
        <Link
          href={debtId ? `/debts/${debtId}` : "/debts"}
          className={`${brandSecondaryButton} h-12`}
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
