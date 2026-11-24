import type { InstallmentState } from "@/lib/debt";

/** Direction colors: the orange series for what I owe, the green one for what I am owed. */
export const DIRECTION = {
  I_OWE: { label: "Tôi nợ", color: "var(--series-2)", short: "Tôi nợ" },
  THEY_OWE: { label: "Nợ tôi", color: "var(--series-3)", short: "Nợ tôi" },
} as const;

/** Installment states: always a written label, the color only supports it. */
export const STATE: Record<InstallmentState, { label: string; className: string }> = {
  paid: {
    label: "Đã trả",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  partial: {
    label: "Trả một phần",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  upcoming: {
    label: "Sắp tới",
    className: "bg-[var(--dash-track)] text-[var(--dash-muted)]",
  },
  overdue: {
    label: "Quá hạn",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

export function StateBadge({ state }: { state: InstallmentState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${STATE[state].className}`}
    >
      {state === "overdue" ? "! " : state === "paid" ? "✓ " : ""}
      {STATE[state].label}
    </span>
  );
}

/** First letter of a name for the round monogram. */
export function Monogram({ name, color }: { name: string; color: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
      style={{ background: color }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** How far a debt is paid back, as a meter with a written value. */
export function PaidMeter({
  label,
  paid,
  principal,
  color,
}: {
  label: string;
  paid: number;
  principal: number;
  color: string;
}) {
  const percent = principal > 0 ? Math.round((paid / principal) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`Đã trả ${percent}%`}
      className="h-2.5 overflow-hidden rounded-full bg-[var(--dash-track)]"
    >
      <div
        className="h-full origin-left animate-[lm-grow_800ms_var(--ease-lm)_both] rounded-full"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

/** Whole days from one calendar day to another (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "Hôm nay", "Còn 3 ngày", "Quá hạn 5 ngày". */
export function dueText(dueDate: string, today: string): string {
  const days = daysBetween(today, dueDate);
  if (days === 0) return "Đến hạn hôm nay";
  if (days > 0) return `Còn ${days} ngày`;
  return `Quá hạn ${-days} ngày`;
}
