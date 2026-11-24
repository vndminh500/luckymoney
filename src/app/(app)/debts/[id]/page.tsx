import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deletePaymentAction } from "@/app/(app)/debts/actions";
import { DeleteDebtButton } from "@/components/debts/delete-debt-dialog";
import { DIRECTION, Monogram, PaidMeter, StateBadge, dueText } from "@/components/debts/debt-ui";
import { PaymentForm } from "@/components/debts/payment-form";
import { brandSecondaryButton } from "@/components/ui/brand-form";
import { formatDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { getDebt, todayForUser, type DebtDetail } from "@/server/debts/service";
import { NotFoundError } from "@/server/errors";
import { getPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Khoản nợ" };

const card =
  "flex flex-col gap-4 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6";

export default function DebtPage({ params }: PageProps<"/debts/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <Debt params={params} />
      </Suspense>
    </main>
  );
}

async function load(userId: string, id: string): Promise<{ debt: DebtDetail; today: string }> {
  const today = await todayForUser(userId);
  try {
    return { debt: await getDebt(userId, id, today), today };
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

async function Debt({ params }: Pick<PageProps<"/debts/[id]">, "params">) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  const [{ debt, today }, display] = await Promise.all([
    load(user.id, id),
    getPreferences(user.id),
  ]);
  const { status } = debt;
  const direction = DIRECTION[debt.direction];
  const money = (amount: number) => formatMoney(amount, display.amountFormat);
  const date = (key: string) => formatDateKey(key, display.dateFormat);
  const payLabel = debt.direction === "I_OWE" ? "Ghi lần trả" : "Ghi lần thu";
  const historyLabel = debt.direction === "I_OWE" ? "Các lần đã trả" : "Các lần đã thu";

  return (
    <>
      <Link
        href="/debts"
        className="self-start rounded-lg text-[var(--dash-muted)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep"
      >
        ‹ Sổ nợ
      </Link>

      <section className={card} aria-labelledby="debt-title">
        <div className="flex flex-wrap items-center gap-4">
          <Monogram name={debt.counterparty} color={direction.color} />
          <div className="min-w-0 flex-1">
            <h1 id="debt-title" className="truncate text-[1.75rem] leading-tight font-bold">
              {debt.counterparty}
            </h1>
            <p className="text-[var(--dash-muted)]">
              {direction.label} · vay ngày {date(debt.startDate)}
              {debt.note ? ` · ${debt.note}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/debts/${debt.id}/edit`} className={brandSecondaryButton}>
              Sửa
            </Link>
            <DeleteDebtButton debtId={debt.id} name={debt.counterparty} />
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 tabular-nums">
          <div>
            <dt className="text-sm text-[var(--dash-muted)]">Số tiền nợ</dt>
            <dd className="text-lg font-bold">{money(status.principal)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--dash-muted)]">Đã trả</dt>
            <dd className="text-lg font-bold">{money(status.paid)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--dash-muted)]">Còn lại</dt>
            <dd className="text-lg font-bold">{money(status.remaining)}</dd>
          </div>
        </dl>
        <PaidMeter
          label={`Đã trả khoản nợ ${debt.counterparty}`}
          paid={status.paid}
          principal={status.principal}
          color={direction.color}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className={card} aria-labelledby="schedule-title">
          <h2 id="schedule-title" className="text-lg font-bold">
            Lịch trả dự kiến
          </h2>
          <ol aria-label="Lịch trả" className="flex flex-col divide-y divide-[var(--dash-border)]">
            {status.installments.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="w-6 text-sm text-[var(--dash-muted)] tabular-nums">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">{date(item.dueDate)}</p>
                  <p className="text-sm text-[var(--dash-muted)] tabular-nums">
                    {item.state === "paid"
                      ? money(item.amount)
                      : item.paid > 0
                        ? `${money(item.paid)} / ${money(item.amount)}`
                        : money(item.amount)}
                    {item.state === "upcoming" ||
                    item.state === "overdue" ||
                    item.state === "partial"
                      ? ` · ${dueText(item.dueDate, today)}`
                      : ""}
                  </p>
                </div>
                <StateBadge state={item.state} />
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-6">
          {status.settled ? (
            <section className={card}>
              <h2 className="text-lg font-bold">Đã trả xong</h2>
              <p className="text-[var(--dash-muted)]">Khoản nợ này không còn gì phải trả.</p>
            </section>
          ) : (
            <section className={card} aria-labelledby="pay-title">
              <h2 id="pay-title" className="text-lg font-bold">
                {payLabel}
              </h2>
              <PaymentForm
                debtId={debt.id}
                suggested={status.nextDue?.left ?? status.remaining}
                today={today}
                payLabel={payLabel}
              />
            </section>
          )}

          <section className={card} aria-labelledby="payments-title">
            <h2 id="payments-title" className="text-lg font-bold">
              {historyLabel}
            </h2>
            {debt.payments.length === 0 ? (
              <p className="text-[var(--dash-muted)]">Chưa có lần nào.</p>
            ) : (
              <ul
                aria-label={historyLabel}
                className="flex flex-col divide-y divide-[var(--dash-border)]"
              >
                {debt.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold tabular-nums">{money(payment.amount)}</p>
                      <p className="truncate text-sm text-[var(--dash-muted)]">
                        {date(payment.paidOn)}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    <form action={deletePaymentAction.bind(null, debt.id, payment.id)}>
                      <button
                        type="submit"
                        aria-label={`Hoàn tác lần trả ${money(payment.amount)} ngày ${date(payment.paidOn)}`}
                        className="rounded-lg px-2 py-1 text-sm text-[var(--dash-muted)] transition-colors hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep"
                      >
                        Hoàn tác
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
