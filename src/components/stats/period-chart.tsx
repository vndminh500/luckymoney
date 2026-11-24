"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { StatsPeriod } from "@/lib/schemas/stats";
import { formatDateKey, type DateFormat } from "@/lib/dates";
import { formatMoney, formatVndCompact, type AmountFormat } from "@/lib/money";
import type { DisplayPreferences } from "@/server/settings/service";
import type { PeriodBucket } from "@/server/stats/service";

type Series = "expense" | "income";

const SERIES: { value: Series; label: string; color: string }[] = [
  { value: "expense", label: "Chi", color: "var(--series-1)" },
  { value: "income", label: "Thu", color: "var(--series-income)" },
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Short axis label of a bucket. */
function tickLabel(period: StatsPeriod, key: string): string {
  if (period === "year") {
    return `Th${Number(key.slice(5, 7))}`;
  }
  if (period === "week") {
    const [year, month, day] = key.split("-").map(Number);
    return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  }
  return String(Number(key.slice(8, 10)));
}

/** Full label of a bucket for the tooltip and the table. */
function fullLabel(period: StatsPeriod, key: string, dateFormat: DateFormat): string {
  if (period === "year") {
    return `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`;
  }
  const date = formatDateKey(key, dateFormat);
  return period === "week" ? `${tickLabel(period, key)}, ${date}` : date;
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: PeriodBucket }[];
  period: StatsPeriod;
  amountFormat: AmountFormat;
  dateFormat: DateFormat;
};

function BucketTooltip({ active, payload, period, amountFormat, dateFormat }: TooltipProps) {
  const bucket = active ? payload?.[0]?.payload : undefined;
  if (!bucket) {
    return null;
  }
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm shadow-[0_8px_24px_rgb(6_43_69/0.12)]">
      <p className="font-medium">{fullLabel(period, bucket.key, dateFormat)}</p>
      <p className="tabular-nums">Chi {formatMoney(bucket.expense, amountFormat)}</p>
      <p className="tabular-nums">Thu {formatMoney(bucket.income, amountFormat)}</p>
    </div>
  );
}

type Props = { period: StatsPeriod; buckets: PeriodBucket[]; display: DisplayPreferences };

/**
 * Bars of the period's buckets for one series at a time: income and expense
 * have different scales (one salary dwarfs daily spending), so the reader
 * switches between them instead of sharing one axis.
 */
export function PeriodChart({ period, buckets, display }: Props) {
  const [series, setSeries] = useState<Series>("expense");
  const current = SERIES.find((option) => option.value === series) ?? SERIES[0];
  const hasData = buckets.some((bucket) => bucket[series] > 0);
  const ticks =
    period === "month"
      ? buckets
          .map((bucket) => bucket.key)
          .filter((key) => [1, 8, 15, 22, 29].includes(Number(key.slice(8, 10))))
      : buckets.map((bucket) => bucket.key);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {current.label} theo {period === "year" ? "tháng" : "ngày"}
        </h2>
        <div
          role="group"
          aria-label="Chuỗi số liệu"
          className="flex rounded-full bg-[var(--dash-track)] p-1"
        >
          {SERIES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={series === option.value}
              onClick={() => setSeries(option.value)}
              className="rounded-full px-4 py-1.5 font-medium text-[var(--dash-muted)] transition-[background-color,color,box-shadow] duration-200 ease-lm hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-pressed:bg-[var(--dash-surface)] aria-pressed:text-[var(--dash-text)] aria-pressed:shadow-[0_2px_8px_rgb(6_43_69/0.12)]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div
          className="h-72 w-full"
          role="img"
          aria-label={`Biểu đồ cột ${current.label.toLowerCase()} theo ${period === "year" ? "tháng" : "ngày"}, chi tiết trong bảng bên dưới`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
              barCategoryGap={period === "month" ? 2 : "20%"}
            >
              <CartesianGrid vertical={false} stroke="var(--dash-grid)" />
              <XAxis
                dataKey="key"
                ticks={ticks}
                interval={0}
                tickFormatter={(key: string) => tickLabel(period, key)}
                tickLine={false}
                axisLine={{ stroke: "var(--dash-border)" }}
                tick={{ fill: "var(--dash-muted)", fontSize: 13 }}
              />
              <YAxis
                width={52}
                tickFormatter={(value: number) => formatVndCompact(value)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--dash-muted)", fontSize: 13 }}
              />
              <Tooltip
                content={
                  <BucketTooltip
                    period={period}
                    amountFormat={display.amountFormat}
                    dateFormat={display.dateFormat}
                  />
                }
                cursor={{ fill: "var(--dash-track)" }}
                isAnimationActive={false}
              />
              <Bar
                // A new key per series replays the grow-in animation on switch.
                key={series}
                dataKey={series}
                name={current.label}
                fill={current.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={period === "month" ? 18 : 44}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-[var(--dash-muted)]">
          Không có khoản {current.label.toLowerCase()} nào trong kỳ này.
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--dash-muted)] hover:text-[var(--dash-text)]">
          Xem dạng bảng
        </summary>
        <table className="mt-3 w-full tabular-nums">
          <caption className="sr-only">Thu và chi theo kỳ</caption>
          <thead className="text-left text-[var(--dash-muted)]">
            <tr>
              <th scope="col" className="py-1 font-medium">
                {period === "year" ? "Tháng" : "Ngày"}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Chi
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Thu
              </th>
            </tr>
          </thead>
          <tbody>
            {buckets
              .filter((bucket) => bucket.expense > 0 || bucket.income > 0)
              .map((bucket) => (
                <tr key={bucket.key} className="border-t border-[var(--dash-border)]">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {fullLabel(period, bucket.key, display.dateFormat)}
                  </th>
                  <td className="py-1.5 text-right">
                    {formatMoney(bucket.expense, display.amountFormat)}
                  </td>
                  <td className="py-1.5 text-right">
                    {formatMoney(bucket.income, display.amountFormat)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
