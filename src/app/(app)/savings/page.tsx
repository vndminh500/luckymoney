import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddJarForm } from "@/components/savings/jar-forms";
import { LoadingState } from "@/components/ui/loading-state";
import { formatDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { listJars } from "@/server/savings/service";
import { getPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Tích góp" };

const card = "rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)]";

export default function SavingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<LoadingState />}>
        <Savings />
      </Suspense>
    </main>
  );
}

async function Savings() {
  const user = await getCurrentUser();
  const [{ jars, total }, display] = await Promise.all([
    listJars(user.id),
    getPreferences(user.id),
  ]);
  const money = (amount: number) => formatMoney(amount, display.amountFormat);

  return (
    <>
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Tích góp</h1>
        <p className="mt-1 text-[var(--dash-muted)]">
          Chia tiền để dành vào từng hũ. Tích góp không tính vào thu chi.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="savings-total"
            className="rounded-2xl bg-[linear-gradient(135deg,#30afff,#92eeff)] p-6 text-lm-ink shadow-[0_14px_36px_color-mix(in_srgb,var(--lm-sky)_35%,transparent)] dark:bg-[linear-gradient(135deg,#0f828c,#065084)] dark:text-[#eaf4f3]"
          >
            <h2 id="savings-total" className="font-medium opacity-80">
              Tổng tiền tích góp
            </h2>
            <p className="mt-1 text-[2.25rem] leading-tight font-bold tabular-nums [overflow-wrap:anywhere]">
              {money(total)}
            </p>
            <p className="mt-1 opacity-80">
              {jars.length === 0 ? "Chưa có hũ nào" : `Trong ${jars.length} hũ`}
            </p>
          </section>

          {jars.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--dash-border)] px-4 py-10 text-center text-[var(--dash-muted)]">
              Chưa có hũ nào. Tạo hũ đầu tiên, ví dụ “Quỹ khẩn cấp”.
            </p>
          ) : (
            <ul aria-label="Các hũ" className="grid gap-3 sm:grid-cols-2">
              {jars.map((jar, index) => {
                const share = total > 0 ? Math.round((jar.balance / total) * 100) : 0;
                return (
                  <li
                    key={jar.id}
                    className="min-w-0 animate-lm-rise"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <Link
                      href={`/savings/${jar.id}`}
                      className={`${card} flex h-full flex-col gap-3 p-5 transition-[border-color,box-shadow,transform] duration-200 ease-lm hover:-translate-y-0.5 hover:border-lm-sky hover:shadow-[0_12px_28px_rgb(6_43_69/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-11 shrink-0 place-items-center rounded-full bg-lm-aqua/60 text-xl dark:bg-[#065084]/45"
                        >
                          {jar.icon ?? "🫙"}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-lg font-bold">{jar.name}</p>
                      </div>
                      <p className="text-2xl font-bold tabular-nums">{money(jar.balance)}</p>
                      <div
                        role="meter"
                        aria-label={`Phần của hũ ${jar.name} trong tổng tích góp`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={share}
                        aria-valuetext={`${share}% tổng tích góp`}
                        className="h-2 overflow-hidden rounded-full bg-[var(--dash-track)]"
                      >
                        <div
                          className="h-full origin-left animate-[lm-grow_800ms_var(--ease-lm)_both] rounded-full bg-[var(--series-1)]"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="flex flex-wrap justify-between gap-x-2 text-sm text-[var(--dash-muted)]">
                        <span>{share}% tổng</span>
                        <span>
                          {jar.lastActivity
                            ? `Gần nhất ${formatDateKey(jar.lastActivity, display.dateFormat)}`
                            : "Chưa nạp lần nào"}
                        </span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <section
          aria-labelledby="new-jar-title"
          className={`${card} flex flex-col gap-4 p-5 sm:p-6`}
        >
          <h2 id="new-jar-title" className="text-lg font-bold">
            Tạo hũ mới
          </h2>
          <AddJarForm />
        </section>
      </div>
    </>
  );
}
