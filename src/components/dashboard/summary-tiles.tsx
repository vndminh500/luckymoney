import { formatMoney } from "@/lib/money";
import type { DisplayPreferences } from "@/server/settings/service";
import type { Summary } from "@/server/stats/service";

/** Income, expense and balance of the month: the numbers are the chart. */
export function SummaryTiles({
  summary,
  display,
}: {
  summary: Pick<Summary, "income" | "expense" | "balance">;
  display: DisplayPreferences;
}) {
  const tiles = [
    { label: "Thu", value: summary.income, sign: summary.income > 0 ? "+" : "" },
    { label: "Chi", value: summary.expense, sign: summary.expense > 0 ? "−" : "" },
    { label: "Số dư", value: summary.balance, sign: "" },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={`animate-lm-rise rounded-2xl border border-[var(--dash-border)] p-5 ${
            tile.label === "Số dư"
              ? "bg-lm-sky text-lm-ink shadow-[0_10px_24px_color-mix(in_srgb,var(--lm-sky)_28%,transparent)]"
              : "bg-[var(--dash-surface)]"
          }`}
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <dt
            className={
              tile.label === "Số dư" ? "font-medium text-lm-ink/80" : "text-[var(--dash-muted)]"
            }
          >
            {tile.label}
          </dt>
          <dd className="mt-1 text-[1.75rem] leading-tight font-bold tracking-[-0.01em] tabular-nums">
            {tile.sign}
            {formatMoney(tile.value, display.amountFormat)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
