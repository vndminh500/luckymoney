import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BudgetAlerts } from "@/components/dashboard/budget-alerts";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { SummaryTiles } from "@/components/dashboard/summary-tiles";
import { addMonths } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth/session";
import { getBudgetAlerts, getPreferences } from "@/server/settings/service";
import { ValidationError } from "@/server/errors";
import { getDailyStats, getStatsByCategory, getSummary } from "@/server/stats/service";

export const metadata: Metadata = { title: "Tổng quan" };

const monthButton =
  "grid size-10 place-items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-lg transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep";

/** The signed-in home page: the monthly dashboard (PRD F4). */
export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      {/* The user, the month and its numbers are request data: they stream in. */}
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

/** The month's statistics, or null when the URL holds an invalid month. */
async function loadStats(userId: string, month: string | undefined) {
  const query = { month };
  try {
    return await Promise.all([
      getSummary(userId, query),
      getStatsByCategory(userId, query),
      getDailyStats(userId, query),
    ]);
  } catch (error) {
    if (error instanceof ValidationError) {
      return null;
    }
    throw error;
  }
}

async function Dashboard({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const month = typeof params.month === "string" && params.month ? params.month : undefined;
  const [stats, display] = await Promise.all([loadStats(user.id, month), getPreferences(user.id)]);

  const greeting = (
    <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">
      Xin chào, {user.name ?? user.email}
    </h1>
  );

  if (!stats) {
    return (
      <>
        {greeting}
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900"
        >
          Tháng không hợp lệ.{" "}
          <Link href="/" className="font-medium underline">
            Xem tháng này
          </Link>
        </p>
      </>
    );
  }

  const [summary, byCategory, daily] = stats;
  const current = summary.month;
  const alerts = await getBudgetAlerts(user.id, current);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {greeting}
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/?month=${addMonths(current, -1)}`}
              aria-label="Tháng trước"
              className={monthButton}
            >
              ‹
            </Link>
            <h2 className="min-w-36 text-center text-lg font-medium">{monthLabel(current)}</h2>
            <Link
              href={`/?month=${addMonths(current, 1)}`}
              aria-label="Tháng sau"
              className={monthButton}
            >
              ›
            </Link>
          </div>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex h-12 items-center rounded-xl bg-lm-sky px-5 font-bold text-lm-ink shadow-[0_6px_16px_rgb(48_175_255/0.35)] transition-[background-color,transform] duration-200 ease-lm hover:bg-[#4dbaff] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep"
        >
          Thêm giao dịch
        </Link>
      </div>

      <section aria-label="Tổng quan tháng">
        <SummaryTiles summary={summary} display={display} />
      </section>

      <BudgetAlerts alerts={alerts} month={current} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">Chi theo danh mục</h2>
            <Link
              href={`/transactions?month=${current}&type=EXPENSE`}
              className="text-sm font-medium text-lm-deep underline-offset-4 hover:underline dark:text-lm-aqua"
            >
              Xem giao dịch
            </Link>
          </div>
          <CategoryDonut items={byCategory.items} display={display} />
        </section>
        <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
          <h2 className="mb-5 text-lg font-bold">Chi theo ngày</h2>
          <DailyChart days={daily.days} display={display} />
        </section>
      </div>
    </>
  );
}
