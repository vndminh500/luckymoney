"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatMoney } from "@/lib/money";
import type { DisplayPreferences } from "@/server/settings/service";
import type { CategoryTotal } from "@/server/stats/service";

/** Categories that get their own slice; the rest fold into "Khác" (other). */
const COLORED_SLOTS = 5;

const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

type Slice = {
  key: string;
  name: string;
  icon: string | null;
  total: number;
  percent: number;
  color: string;
  /** How many categories a folded "Khác" slice holds. */
  count?: number;
};

function toSlices(items: CategoryTotal[]): Slice[] {
  const slices: Slice[] = items.slice(0, COLORED_SLOTS).map((item, index) => ({
    key: item.categoryId,
    name: item.name,
    icon: item.icon,
    total: item.total,
    percent: item.percent,
    color: `var(--series-${index + 1})`,
  }));
  const rest = items.slice(COLORED_SLOTS);
  if (rest.length > 0) {
    slices.push({
      key: "other",
      name: "Khác",
      icon: null,
      total: rest.reduce((sum, item) => sum + item.total, 0),
      percent: Math.round(rest.reduce((sum, item) => sum + item.percent, 0) * 10) / 10,
      color: "var(--series-other)",
      count: rest.length,
    });
  }
  return slices;
}

/**
 * Where the month's spending went, as a donut: up to five categories with
 * their own color plus "Khác", the month's total in the middle, and a legend
 * with every figure, so a slice is never identified by color alone.
 * Hovering a slice or a legend row highlights the pair and shows it in the centre.
 */
export function CategoryDonut({
  items,
  display,
}: {
  items: CategoryTotal[];
  display: DisplayPreferences;
}) {
  const [active, setActive] = useState<number | null>(null);
  const money = (amount: number) => formatMoney(amount, display.amountFormat);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--dash-muted)]">
        Chưa có khoản chi nào trong tháng này.
      </p>
    );
  }

  const slices = toSlices(items);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);
  const shown = active === null ? null : slices[active];
  const dimmed = (index: number) => active !== null && active !== index;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <div
        className="relative mx-auto aspect-square w-full max-w-52"
        role="img"
        aria-label="Biểu đồ tròn chi tiêu theo danh mục, chi tiết trong danh sách bên cạnh"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--dash-surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.key}
                  fill={slice.color}
                  style={{ opacity: dimmed(index) ? 0.3 : 1, transition: "opacity 200ms ease" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label: the month's total, or the hovered slice. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
          <div key={shown?.key ?? "total"} className="animate-lm-rise [animation-duration:220ms]">
            <p className="truncate text-sm text-[var(--dash-muted)]">
              {shown ? shown.name : "Tổng chi"}
            </p>
            <p className="font-bold tabular-nums">{money(shown ? shown.total : total)}</p>
            {shown ? (
              <p className="text-sm text-[var(--dash-muted)] tabular-nums">
                {percentFormat.format(shown.percent)}%
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ol aria-label="Chi tiêu theo danh mục" className="flex min-w-0 flex-col gap-0.5">
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl px-3 py-1.5 transition-[background-color,opacity] duration-200 ${
              active === index ? "bg-[var(--dash-track)]" : ""
            } ${dimmed(index) ? "opacity-50" : ""}`}
          >
            <span
              aria-hidden="true"
              className="row-span-2 size-3 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="truncate font-medium">
              {slice.icon ? `${slice.icon} ` : ""}
              {slice.name}
              {slice.count ? (
                <span className="ml-1 text-sm font-normal text-[var(--dash-muted)]">
                  ({slice.count} danh mục)
                </span>
              ) : null}
            </span>
            <span className="text-right text-[var(--dash-muted)] tabular-nums">
              {percentFormat.format(slice.percent)}%
            </span>
            <span className="col-start-2 text-sm tabular-nums">{money(slice.total)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
