import Link from "next/link";

import { brandControlCompact, brandSecondaryButton } from "@/components/ui/brand-form";
import { addMonths, formatDateKey, toDateKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CategoryDto } from "@/server/categories/service";
import type { DisplayPreferences } from "@/server/settings/service";
import type { TransactionPage } from "@/server/transactions/service";

/** Filters kept in the URL of /transactions. */
export type ListFilters = { month: string; type?: string; categoryId?: string; page?: number };

export function transactionsHref({ month, type, categoryId, page }: ListFilters): string {
  const params = new URLSearchParams({ month });
  if (type) params.set("type", type);
  if (categoryId) params.set("categoryId", categoryId);
  if (page && page > 1) params.set("page", String(page));
  return `/transactions?${params}`;
}

const monthButton =
  "grid size-10 place-items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-lg transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep";

function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  result: TransactionPage;
  filters: ListFilters;
  categories: CategoryDto[];
  display: DisplayPreferences;
};

export function TransactionList({ result, filters, categories, display }: Props) {
  const { month, timeZone, items, page, pageSize, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const sameFilters = { type: filters.type, categoryId: filters.categoryId };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Chọn tháng" className="flex items-center gap-2">
          <Link
            href={transactionsHref({ ...sameFilters, month: addMonths(month, -1) })}
            aria-label="Tháng trước"
            className={monthButton}
          >
            ‹
          </Link>
          <h2 className="min-w-36 text-center text-lg font-medium">{monthLabel(month)}</h2>
          <Link
            href={transactionsHref({ ...sameFilters, month: addMonths(month, 1) })}
            aria-label="Tháng sau"
            className={monthButton}
          >
            ›
          </Link>
        </nav>

        <form
          method="get"
          action="/transactions"
          className="flex flex-wrap items-end gap-2"
          aria-label="Lọc giao dịch"
        >
          <input type="hidden" name="month" value={month} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Loại
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              className={`${brandControlCompact} w-32`}
            >
              <option value="">Tất cả</option>
              <option value="EXPENSE">Chi</option>
              <option value="INCOME">Thu</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Danh mục
            <select
              name="categoryId"
              defaultValue={filters.categoryId ?? ""}
              className={`${brandControlCompact} w-52`}
            >
              <option value="">Tất cả</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name} ({category.type === "EXPENSE" ? "chi" : "thu"}
                  {category.archived ? ", đã lưu trữ" : ""})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={brandSecondaryButton}>
            Lọc
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-12 text-center">
          <p className="text-[var(--dash-muted)]">
            Không có giao dịch nào trong {monthLabel(month).toLowerCase()}.
          </p>
          <Link href="/transactions/new" className={brandSecondaryButton}>
            Thêm giao dịch đầu tiên
          </Link>
        </div>
      ) : (
        <ul
          aria-label="Giao dịch"
          className="overflow-hidden rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)]"
        >
          {items.map((item, index) => {
            const income = item.type === "INCOME";
            return (
              <li
                key={item.id}
                className="animate-lm-rise border-t border-[var(--dash-border)] first:border-t-0"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
                <Link
                  href={`/transactions/${item.id}/edit`}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors duration-200 hover:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lm-deep sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-11 shrink-0 place-items-center rounded-full text-xl transition-transform duration-200 ease-lm group-hover:scale-105 ${
                      income
                        ? "bg-lm-mint dark:bg-emerald-900/60"
                        : "bg-lm-aqua/60 dark:bg-[#123a55]"
                    }`}
                  >
                    {item.category.icon ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.category.name}
                      {item.category.archived ? (
                        <span className="ml-2 text-sm font-normal text-[var(--dash-muted)]">
                          (đã lưu trữ)
                        </span>
                      ) : null}
                    </span>
                    {item.note ? (
                      <span className="block truncate text-sm text-[var(--dash-muted)]">
                        {item.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block font-bold tabular-nums ${
                        income ? "text-emerald-700 dark:text-emerald-400" : ""
                      }`}
                    >
                      {income ? "+" : "−"}
                      {formatMoney(item.amount, display.amountFormat)}
                    </span>
                    <span className="block text-sm text-[var(--dash-muted)] tabular-nums">
                      {formatDateKey(toDateKey(item.occurredAt, timeZone), display.dateFormat)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Phân trang" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={transactionsHref({ ...filters, month, page: page - 1 })}
              className={brandSecondaryButton}
            >
              <Chevron direction="left" />
              Trang trước
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-[var(--dash-muted)] tabular-nums">
            Trang {page}/{pageCount}
          </p>
          {page < pageCount ? (
            <Link
              href={transactionsHref({ ...filters, month, page: page + 1 })}
              className={brandSecondaryButton}
            >
              Trang sau
              <Chevron direction="right" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
