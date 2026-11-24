import Link from "next/link";

import type { BudgetAlert } from "@/server/settings/service";

const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/**
 * In-app budget notifications (Cài đặt > Thông báo): the month's budgets at 80%
 * or over 100%. Each pairs the status color with an icon and words.
 */
export function BudgetAlerts({ alerts, month }: { alerts: BudgetAlert[]; month: string }) {
  if (alerts.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Cảnh báo ngân sách"
      className="animate-lm-rise rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">Cảnh báo ngân sách</h2>
        <Link
          href={`/budgets?month=${month}`}
          className="text-sm font-medium underline underline-offset-4"
        >
          Xem ngân sách
        </Link>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {alerts.map((alert) => (
          <li key={alert.budgetId} className="flex items-center gap-2">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`size-4 shrink-0 ${
                alert.status === "over"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {alert.status === "over" ? (
                <>
                  <circle cx="10" cy="10" r="8" fill="currentColor" />
                  <path
                    d="M7 7l6 6M13 7l-6 6"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <path d="M10 2.5 18.5 17h-17z" fill="currentColor" />
                  <path d="M10 8v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="10" cy="14.6" r="1.1" fill="white" />
                </>
              )}
            </svg>
            <span>
              <span className="font-medium">
                {alert.icon ? `${alert.icon} ` : ""}
                {alert.name}
              </span>
              {": "}
              {alert.status === "over" ? "đã vượt hạn mức" : "sắp chạm hạn mức"} (
              {percentFormat.format(alert.percentUsed)}%)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
