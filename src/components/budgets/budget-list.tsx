import { deleteBudgetAction } from "@/app/(app)/budgets/actions";
import type { BudgetStatus } from "@/lib/budget";
import { formatVnd } from "@/lib/money";
import type { BudgetProgress } from "@/server/budgets/service";

const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/**
 * Status cues: a fill color from the fixed status palette, always paired with
 * an icon and a written label so the state never depends on color alone.
 */
const STATUS: Record<BudgetStatus, { label: string; fill: string; text: string } | null> = {
  ok: null,
  warning: {
    label: "Sắp chạm hạn mức",
    fill: "#fab219",
    text: "text-amber-800 dark:text-amber-300",
  },
  over: {
    label: "Vượt hạn mức",
    fill: "#d03b3b",
    text: "text-red-700 dark:text-red-400",
  },
};

function StatusIcon({ status }: { status: BudgetStatus }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
      {status === "over" ? (
        <>
          <circle cx="10" cy="10" r="8" fill="currentColor" />
          <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M10 2.5 18.5 17h-17z" fill="currentColor" />
          <path d="M10 8v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14.6" r="1.1" fill="white" />
        </>
      )}
    </svg>
  );
}

export function BudgetList({ items }: { items: BudgetProgress[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--dash-border)] px-4 py-10 text-center text-[var(--dash-muted)]">
        Chưa có ngân sách cho tháng này. Đặt hạn mức cho một danh mục ở form phía trên.
      </p>
    );
  }

  return (
    <ul aria-label="Ngân sách" className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => {
        const status = STATUS[item.status];
        const remaining = item.amount - item.spent;
        return (
          <li
            key={item.id}
            className="flex animate-lm-rise flex-col gap-3 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-lg font-bold">
                {item.icon ? `${item.icon} ` : ""}
                {item.name}
                {item.archived ? (
                  <span className="ml-2 text-sm font-normal text-[var(--dash-muted)]">
                    (đã lưu trữ)
                  </span>
                ) : null}
              </p>
              <form action={deleteBudgetAction.bind(null, item.id)}>
                <button
                  type="submit"
                  aria-label={`Xóa ngân sách ${item.name}`}
                  className="rounded-lg px-2 py-1 text-sm text-[var(--dash-muted)] transition-colors hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep"
                >
                  Xóa
                </button>
              </form>
            </div>

            <p className="tabular-nums">
              <span className="font-bold">{formatVnd(item.spent)}</span>
              <span className="text-[var(--dash-muted)]"> / {formatVnd(item.amount)}</span>
            </p>

            <div
              role="meter"
              aria-label={`Đã dùng ngân sách ${item.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(item.percentUsed, 100)}
              aria-valuetext={`${percentFormat.format(item.percentUsed)}%`}
              className="h-2.5 overflow-hidden rounded-full bg-[var(--dash-track)]"
            >
              <div
                className="h-full origin-left animate-[lm-grow_800ms_var(--ease-lm)_both] rounded-full"
                style={{
                  width: `${Math.min(item.percentUsed, 100)}%`,
                  background: status?.fill ?? "var(--series-1)",
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium tabular-nums">
                Đã dùng {percentFormat.format(item.percentUsed)}%
              </span>
              {status ? (
                <span className={`flex items-center gap-1.5 font-medium ${status.text}`}>
                  <StatusIcon status={item.status} />
                  {status.label}
                </span>
              ) : (
                <span className="text-[var(--dash-muted)] tabular-nums">
                  Còn {formatVnd(remaining)}
                </span>
              )}
            </div>
            {item.status === "over" ? (
              <p className={`text-sm tabular-nums ${STATUS.over?.text ?? ""}`}>
                Đã vượt {formatVnd(-remaining)}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
