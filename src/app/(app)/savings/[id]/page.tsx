import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EntryForm } from "@/components/savings/entry-form";
import { JarControls, UndoEntryButton } from "@/components/savings/jar-controls";
import { LoadingState } from "@/components/ui/loading-state";
import { formatDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { todayForUser } from "@/server/debts/service";
import { NotFoundError } from "@/server/errors";
import { getJar } from "@/server/savings/service";
import { getPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Hũ tích góp" };

const card =
  "flex flex-col gap-4 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6";

export default function JarPage({ params }: PageProps<"/savings/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<LoadingState />}>
        <Jar params={params} />
      </Suspense>
    </main>
  );
}

async function Jar({ params }: Pick<PageProps<"/savings/[id]">, "params">) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  const [jar, display, today] = await Promise.all([
    getJar(user.id, id).catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    getPreferences(user.id),
    todayForUser(user.id),
  ]);
  const money = (amount: number) => formatMoney(amount, display.amountFormat);
  const date = (key: string) => formatDateKey(key, display.dateFormat);

  return (
    <>
      <Link
        href="/savings"
        className="self-start rounded-lg text-[var(--dash-muted)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep"
      >
        ‹ Tích góp
      </Link>

      <section className={card} aria-labelledby="jar-title">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-lm-aqua/60 text-3xl dark:bg-[#065084]/45"
          >
            {jar.icon ?? "🫙"}
          </span>
          <div className="min-w-0 flex-1">
            <h1
              id="jar-title"
              className="text-[1.75rem] leading-tight font-bold [overflow-wrap:anywhere]"
            >
              {jar.name}
            </h1>
            <p className="text-[2rem] leading-tight font-bold tabular-nums [overflow-wrap:anywhere]">
              <span className="sr-only">Số dư: </span>
              {money(jar.balance)}
            </p>
          </div>
        </div>
        <dl className="grid gap-2 tabular-nums sm:grid-cols-2 sm:gap-3">
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-sm text-[var(--dash-muted)]">Đã nạp</dt>
            <dd className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              + {money(jar.deposited)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-sm text-[var(--dash-muted)]">Đã rút</dt>
            <dd className="text-lg font-bold">− {money(jar.withdrawn)}</dd>
          </div>
        </dl>
        <JarControls jar={jar} balance={money(jar.balance)} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={card} aria-labelledby="entry-title">
          <h2 id="entry-title" className="text-lg font-bold">
            Nạp hoặc rút
          </h2>
          <EntryForm
            jarId={jar.id}
            today={today}
            balance={money(jar.balance)}
            canWithdraw={jar.balance > 0}
          />
        </section>

        <section className={card} aria-labelledby="history-title">
          <h2 id="history-title" className="text-lg font-bold">
            Lịch sử
          </h2>
          {jar.entries.length === 0 ? (
            <p className="text-[var(--dash-muted)]">
              Chưa có lần nạp hay rút nào. Nạp khoản đầu tiên ở form “Nạp hoặc rút”.
            </p>
          ) : (
            <ul
              aria-label="Lịch sử nạp rút"
              className="flex flex-col divide-y divide-[var(--dash-border)]"
            >
              {jar.entries.map((entry) => {
                const deposit = entry.kind === "DEPOSIT";
                return (
                  <li key={entry.id} className="flex items-start gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full font-bold ${
                        deposit
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                      }`}
                    >
                      {deposit ? "+" : "−"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold tabular-nums">
                        <span className="sr-only">{deposit ? "Nạp" : "Rút"} </span>
                        {deposit ? "+" : "−"} {money(entry.amount)}
                      </p>
                      <p className="truncate text-sm text-[var(--dash-muted)]">
                        {date(entry.occurredOn)}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                      <p className="text-sm text-[var(--dash-muted)] tabular-nums">
                        Số dư sau: {money(entry.balanceAfter)}
                      </p>
                    </div>
                    <UndoEntryButton
                      jarId={jar.id}
                      entryId={entry.id}
                      label={`Hoàn tác lần ${deposit ? "nạp" : "rút"} ${money(entry.amount)} ngày ${date(entry.occurredOn)}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
