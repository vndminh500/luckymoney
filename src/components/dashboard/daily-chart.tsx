"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDateKey, type DateFormat } from "@/lib/dates";
import { formatMoney, formatVndCompact, type AmountFormat } from "@/lib/money";
import type { DisplayPreferences } from "@/server/settings/service";
import type { DailyTotal } from "@/server/stats/service";

const dayOf = (date: string) => Number(date.slice(8, 10));

type TooltipProps = {
  active?: boolean;
  payload?: { payload: DailyTotal }[];
  amountFormat: AmountFormat;
  dateFormat: DateFormat;
};

function DayTooltip({ active, payload, amountFormat, dateFormat }: TooltipProps) {
  const day = active ? payload?.[0]?.payload : undefined;
  if (!day) {
    return null;
  }
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm shadow-[0_8px_24px_rgb(6_43_69/0.12)]">
      <p className="font-medium">{formatDateKey(day.date, dateFormat)}</p>
      <p className="tabular-nums">Chi {formatMoney(day.expense, amountFormat)}</p>
      {day.income > 0 ? (
        <p className="text-[var(--dash-muted)] tabular-nums">
          Thu {formatMoney(day.income, amountFormat)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Spending per day of the month. One series (expense), one axis: income has a
 * different scale (a salary dwarfs daily spending) and is in the summary instead.
 */
export function DailyChart({ days, display }: { days: DailyTotal[]; display: DisplayPreferences }) {
  const hasSpending = days.some((day) => day.expense > 0);
  if (!hasSpending) {
    return (
      <p className="py-8 text-center text-[var(--dash-muted)]">
        Chưa có khoản chi nào trong tháng này.
      </p>
    );
  }
  const ticks = days
    .map((day) => day.date)
    .filter((date) => [1, 8, 15, 22, 29].includes(dayOf(date)));

  return (
    <div className="flex flex-col gap-3">
      <div
        className="h-60 w-full lg:h-80"
        role="img"
        aria-label="Biểu đồ cột chi tiêu theo ngày, chi tiết trong bảng bên dưới"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--dash-grid)" />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(date: string) => String(dayOf(date))}
              tickLine={false}
              axisLine={{ stroke: "var(--dash-border)" }}
              tick={{ fill: "var(--dash-muted)", fontSize: 13 }}
            />
            <YAxis
              width={48}
              tickFormatter={(value: number) => formatVndCompact(value)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--dash-muted)", fontSize: 13 }}
            />
            <Tooltip
              content={
                <DayTooltip amountFormat={display.amountFormat} dateFormat={display.dateFormat} />
              }
              cursor={{ fill: "var(--dash-track)" }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              name="Chi"
              fill="var(--series-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="group text-sm">
        <summary className="cursor-pointer text-[var(--dash-muted)] hover:text-[var(--dash-text)]">
          Xem dạng bảng
        </summary>
        <table className="mt-3 w-full tabular-nums">
          <caption className="sr-only">Thu và chi theo ngày</caption>
          <thead className="text-left text-[var(--dash-muted)]">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Ngày
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
            {days
              .filter((day) => day.expense > 0 || day.income > 0)
              .map((day) => (
                <tr key={day.date} className="border-t border-[var(--dash-border)]">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {formatDateKey(day.date, display.dateFormat)}
                  </th>
                  <td className="py-1.5 text-right">
                    {formatMoney(day.expense, display.amountFormat)}
                  </td>
                  <td className="py-1.5 text-right">
                    {formatMoney(day.income, display.amountFormat)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
