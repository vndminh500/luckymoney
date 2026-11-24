import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DIRECTION, Monogram, PaidMeter, StateBadge, dueText } from "@/components/debts/debt-ui";
import { brandPrimaryButton } from "@/components/ui/brand-form";
import { formatDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { listDebts, todayForUser, type DebtSummary } from "@/server/debts/service";
import { getPreferences, type DisplayPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Sổ nợ" };

const VIEWS = [
  { value: "open", label: "Đang nợ" },
  { value: "I_OWE", label: "Tôi nợ" },
  { value: "THEY_OWE", label: "Nợ tôi" },
  { value: "settled", label: "Đã xong" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default function DebtsPage({ searchParams }: PageProps<"/debts">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <Debts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function matches(debt: DebtSummary, view: View): boolean {
  if (view === "settled") return debt.status.settled;
  if (debt.status.settled) return false;
  return view === "open" || debt.direction === view;
}

async function Debts({ searchParams }: Pick<PageProps<"/debts">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const today = await todayForUser(user.id);
  const [{ debts, totals }, display] = await Promise.all([
    listDebts(user.id, today),
    getPreferences(user.id),
  ]);
  const view: View = VIEWS.find((v) => v.value === params.view)?.value ?? "open";
  const shown = debts.filter((debt) => matches(debt, view));
  const money = (amount: number) => formatMoney(amount, display.amountFormat);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Sổ nợ</h1>
          <p className="mt-1 text-[var(--dash-muted)]">
            Ai nợ ai, bao nhiêu, và khi nào trả. Sổ nợ không tính vào thu chi.
          </p>
        </div>
        <Link href="/debts/new" className={brandPrimaryButton}>
          + Thêm khoản nợ
        </Link>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Tile label="Tôi đang nợ" value={money(totals.iOwe)} color={DIRECTION.I_OWE.color} />
        <Tile
          label="Người khác nợ tôi"
          value={money(totals.theyOwe)}
          color={DIRECTION.THEY_OWE.color}
        />
        <Tile
          label="Kỳ quá hạn"
          value={String(totals.overdueCount)}
          color={totals.overdueCount > 0 ? "#d03b3b" : "var(--series-other)"}
        />
      </dl>

      <nav aria-label="Lọc khoản nợ" className="flex flex-wrap gap-2">
        {VIEWS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "open" ? "/debts" : `/debts?view=${option.value}`}
            aria-current={view === option.value ? "page" : undefined}
            className="rounded-full border border-[var(--dash-border)] px-4 py-1.5 font-medium text-[var(--dash-muted)] transition-[border-color,background-color,color] duration-200 ease-lm hover:border-lm-sky hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:border-lm-sky aria-[current=page]:bg-lm-sky/15 aria-[current=page]:text-[var(--dash-text)]"
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--dash-border)] px-4 py-10 text-center text-[var(--dash-muted)]">
          {debts.length === 0
            ? "Chưa có khoản nợ nào. Bấm “Thêm khoản nợ” để ghi lại một khoản vay hoặc cho vay."
            : "Không có khoản nợ nào ở mục này."}
        </p>
      ) : (
        <ul aria-label="Khoản nợ" className="grid gap-3 md:grid-cols-2">
          {shown.map((debt, index) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              today={today}
              display={display}
              delay={index * 50}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
      <dt className="flex items-center gap-2 text-[var(--dash-muted)]">
        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
        {label}
      </dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function DebtCard({
  debt,
  today,
  display,
  delay,
}: {
  debt: DebtSummary;
  today: string;
  display: DisplayPreferences;
  delay: number;
}) {
  const direction = DIRECTION[debt.direction];
  const { status } = debt;
  const money = (amount: number) => formatMoney(amount, display.amountFormat);
  const next = status.nextDue;
  const nextState = next ? status.installments.find((i) => i.id === next.id)?.state : undefined;

  return (
    <li className="animate-lm-rise" style={{ animationDelay: `${delay}ms` }}>
      <Link
        href={`/debts/${debt.id}`}
        className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 transition-[border-color,box-shadow,transform] duration-200 ease-lm hover:-translate-y-0.5 hover:border-lm-sky hover:shadow-[0_12px_28px_rgb(6_43_69/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep"
      >
        <div className="flex items-center gap-3">
          <Monogram name={debt.counterparty} color={direction.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{debt.counterparty}</p>
            <p className="text-sm text-[var(--dash-muted)]">
              {direction.label}
              {debt.note ? ` · ${debt.note}` : ""}
            </p>
          </div>
          {status.overdueCount > 0 ? <StateBadge state="overdue" /> : null}
          {status.settled ? <StateBadge state="paid" /> : null}
        </div>

        <p className="tabular-nums">
          <span className="text-sm text-[var(--dash-muted)]">Còn lại </span>
          <span className="text-xl font-bold">{money(status.remaining)}</span>
          <span className="text-[var(--dash-muted)]"> / {money(status.principal)}</span>
        </p>
        <PaidMeter
          label={`Đã trả khoản nợ ${debt.counterparty}`}
          paid={status.paid}
          principal={status.principal}
          color={direction.color}
        />

        {next ? (
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Kỳ tới: <strong className="tabular-nums">{money(next.left)}</strong> ngày{" "}
              {formatDateKey(next.dueDate, display.dateFormat)}
            </span>
            <span
              className={
                nextState === "overdue"
                  ? "font-medium text-red-700 dark:text-red-400"
                  : "text-[var(--dash-muted)]"
              }
            >
              {dueText(next.dueDate, today)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-[var(--dash-muted)]">Đã trả xong.</p>
        )}
      </Link>
    </li>
  );
}
