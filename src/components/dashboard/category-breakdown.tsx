import { formatVnd } from "@/lib/money";
import type { CategoryTotal } from "@/server/stats/service";

/** Categories that get their own color; the rest share "Khác" (other). */
const COLORED_SLOTS = 5;

const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/**
 * Where the month's spending went: a thin segmented bar for the split at a
 * glance, then ranked bars (one hue, largest first) with name, amount and share.
 * Each row carries its swatch, so color never identifies a category alone.
 */
export function CategoryBreakdown({ items }: { items: CategoryTotal[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--dash-muted)]">
        Chưa có khoản chi nào trong tháng này.
      </p>
    );
  }

  const max = items[0].total;
  const colored = items.slice(0, COLORED_SLOTS);
  const rest = items.slice(COLORED_SLOTS);
  const restTotal = rest.reduce((sum, item) => sum + item.total, 0);
  const restPercent = rest.reduce((sum, item) => sum + item.percent, 0);
  const segments = [
    ...colored.map((item, index) => ({
      key: item.categoryId,
      percent: item.percent,
      color: `var(--series-${index + 1})`,
    })),
    ...(rest.length > 0
      ? [{ key: "other", percent: restPercent, color: "var(--series-other)" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Decorative summary of the list below, which carries every figure. */}
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="h-full origin-left animate-[lm-grow_700ms_var(--ease-lm)_both]"
            style={{ width: `${segment.percent}%`, background: segment.color }}
          />
        ))}
      </div>

      <ol aria-label="Chi tiêu theo danh mục" className="flex flex-col gap-3.5">
        {items.map((item, index) => (
          <li
            key={item.categoryId}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    index < COLORED_SLOTS ? `var(--series-${index + 1})` : "var(--series-other)",
                }}
              />
              <span className="truncate">
                {item.icon ? `${item.icon} ` : ""}
                {item.name}
              </span>
            </span>
            <span className="text-right tabular-nums">
              <span className="font-medium">{formatVnd(item.total)}</span>
              <span className="ml-2 inline-block w-14 text-[var(--dash-muted)]">
                {percentFormat.format(item.percent)}%
              </span>
            </span>
            <span
              aria-hidden="true"
              className="col-span-2 h-1.5 rounded-full bg-[var(--dash-track)]"
            >
              <span
                className="block h-full origin-left animate-[lm-grow_700ms_var(--ease-lm)_both] rounded-full bg-[var(--series-1)]"
                style={{ width: `${(item.total / max) * 100}%`, animationDelay: `${index * 40}ms` }}
              />
            </span>
          </li>
        ))}
      </ol>
      {rest.length > 0 ? (
        <p className="text-sm text-[var(--dash-muted)]">
          &quot;Khác&quot; trên thanh tỉ lệ gồm {rest.length} danh mục, tổng {formatVnd(restTotal)}.
        </p>
      ) : null}
    </div>
  );
}
