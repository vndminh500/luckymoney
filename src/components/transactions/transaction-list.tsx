import Link from "next/link";

import { addMonths, toDateKey } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import type { CategoryDto } from "@/server/categories/service";
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

const linkClass =
  "inline-flex h-10 items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-600 dark:hover:bg-zinc-800";

const selectClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function dayLabel(date: Date, timeZone: string): string {
  const [year, month, day] = toDateKey(date, timeZone).split("-");
  return `${day}/${month}/${year}`;
}

type Props = {
  result: TransactionPage;
  filters: ListFilters;
  categories: CategoryDto[];
};

export function TransactionList({ result, filters, categories }: Props) {
  const { month, timeZone, items, page, pageSize, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const sameFilters = { type: filters.type, categoryId: filters.categoryId };

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Chọn tháng" className="flex items-center justify-between gap-2">
        <Link
          href={transactionsHref({ ...sameFilters, month: addMonths(month, -1) })}
          className={linkClass}
        >
          ← Tháng trước
        </Link>
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <Link
          href={transactionsHref({ ...sameFilters, month: addMonths(month, 1) })}
          className={linkClass}
        >
          Tháng sau →
        </Link>
      </nav>

      <form method="get" action="/transactions" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="month" value={month} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Loại
          <select name="type" defaultValue={filters.type ?? ""} className={selectClass}>
            <option value="">Tất cả</option>
            <option value="EXPENSE">Chi</option>
            <option value="INCOME">Thu</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Danh mục
          <select name="categoryId" defaultValue={filters.categoryId ?? ""} className={selectClass}>
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
        <button type="submit" className={linkClass}>
          Lọc
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          Không có giao dịch nào trong {monthLabel(month).toLowerCase()}.
        </p>
      ) : (
        <ul
          aria-label="Giao dịch"
          className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/transactions/${item.id}/edit`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.category.icon ? `${item.category.icon} ` : ""}
                    {item.category.name}
                    {item.category.archived ? (
                      <span className="ml-2 text-xs font-normal text-zinc-500">(đã lưu trữ)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {dayLabel(item.occurredAt, timeZone)}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-semibold tabular-nums ${
                    item.type === "EXPENSE"
                      ? "text-red-700 dark:text-red-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {item.type === "EXPENSE" ? "−" : "+"}
                  {formatVnd(item.amount)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Phân trang" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={transactionsHref({ ...filters, month, page: page - 1 })}
              className={linkClass}
            >
              ← Trang trước
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Trang {page}/{pageCount}
          </p>
          {page < pageCount ? (
            <Link
              href={transactionsHref({ ...filters, month, page: page + 1 })}
              className={linkClass}
            >
              Trang sau →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
