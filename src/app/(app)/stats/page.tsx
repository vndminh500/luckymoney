import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SummaryTiles } from "@/components/dashboard/summary-tiles";
import { PeriodChart } from "@/components/stats/period-chart";
import { BrandAlert } from "@/components/ui/brand-form";
import { addDays } from "@/lib/dates";
import { STATS_PERIODS, type StatsPeriod } from "@/lib/schemas/stats";
import { getCurrentUser } from "@/server/auth/session";
import { ValidationError } from "@/server/errors";
import { getPeriodStats, type PeriodStats } from "@/server/stats/service";

export const metadata: Metadata = { title: "Thống kê" };

const PERIOD_LABELS: Record<StatsPeriod, string> = { week: "Tuần", month: "Tháng", year: "Năm" };

const navButton =
  "grid size-10 place-items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-lg transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep";

function statsHref(period: StatsPeriod, date?: string): string {
  const params = new URLSearchParams({ period });
  if (date) params.set("date", date);
  return `/stats?${params}`;
}

/** "Tuần 23/11 – 29/11/2026", "Tháng 11/2026" or "Năm 2026". */
function periodTitle({ period, start }: PeriodStats): string {
  const [year, month, day] = start.split("-");
  if (period === "year") return `Năm ${year}`;
  if (period === "month") return `Tháng ${Number(month)}/${year}`;
  const [endYear, endMonth, endDay] = addDays(start, 6).split("-");
  return `Tuần ${day}/${month} – ${endDay}/${endMonth}/${endYear}`;
}

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Thống kê</h1>
      {/* The period comes from the URL and the data from the user: they stream in. */}
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

/** The period's statistics, or null when the URL holds an invalid period or date. */
async function loadStats(userId: string, period?: string, date?: string) {
  try {
    return await getPeriodStats(userId, { period, date });
  } catch (error) {
    if (error instanceof ValidationError) {
      return null;
    }
    throw error;
  }
}

async function Stats({ searchParams }: Pick<PageProps<"/stats">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const date = first(params.date);
  const stats = await loadStats(user.id, first(params.period), date);

  if (!stats) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BrandAlert>Kỳ thống kê không hợp lệ.</BrandAlert>
        <Link
          href="/stats"
          className="font-medium text-lm-deep underline underline-offset-4 dark:text-lm-aqua"
        >
          Xem tháng này
        </Link>
      </div>
    );
  }

  const tabIndex = STATS_PERIODS.indexOf(stats.period);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Period switch; the pill slides between the three tabs. */}
        <nav
          aria-label="Kỳ thống kê"
          className="relative grid grid-cols-3 rounded-full bg-[var(--dash-track)] p-1"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-lm-sky shadow-[0_4px_12px_rgb(48_175_255/0.3)] transition-transform duration-300 ease-lm"
            style={{ transform: `translateX(${tabIndex * 100}%)` }}
          />
          {STATS_PERIODS.map((period) => (
            <Link
              key={period}
              href={statsHref(period, date)}
              aria-current={period === stats.period ? "page" : undefined}
              className="relative z-10 rounded-full px-6 py-2 text-center font-bold text-[var(--dash-muted)] transition-colors duration-300 hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:text-lm-ink"
            >
              {PERIOD_LABELS[period]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={statsHref(stats.period, stats.previous)}
            aria-label={`${PERIOD_LABELS[stats.period]} trước`}
            className={navButton}
          >
            ‹
          </Link>
          <h2 className="min-w-48 text-center text-lg font-medium">{periodTitle(stats)}</h2>
          <Link
            href={statsHref(stats.period, stats.next)}
            aria-label={`${PERIOD_LABELS[stats.period]} sau`}
            className={navButton}
          >
            ›
          </Link>
        </div>
      </div>

      <section aria-label="Tổng kết kỳ">
        <SummaryTiles summary={stats.totals} />
      </section>

      <section className="animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
        <PeriodChart
          key={`${stats.period}-${stats.start}`}
          period={stats.period}
          buckets={stats.buckets}
        />
      </section>
    </>
  );
}
