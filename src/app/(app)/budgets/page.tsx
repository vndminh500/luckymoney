import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BudgetForm } from "@/components/budgets/budget-form";
import { BudgetList } from "@/components/budgets/budget-list";
import { addMonths } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth/session";
import { listBudgets } from "@/server/budgets/service";
import { listSelectableCategories } from "@/server/categories/service";
import { ValidationError } from "@/server/errors";

export const metadata: Metadata = { title: "Ngân sách" };

const monthButton =
  "grid size-10 place-items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-lg transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep";

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <Budgets searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

/** The month's budgets and the expense categories, or null for an invalid month. */
async function loadBudgets(userId: string, month: string | undefined) {
  try {
    return await Promise.all([listBudgets(userId, { month }), listSelectableCategories(userId)]);
  } catch (error) {
    if (error instanceof ValidationError) {
      return null;
    }
    throw error;
  }
}

async function Budgets({ searchParams }: Pick<PageProps<"/budgets">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const month = typeof params.month === "string" && params.month ? params.month : undefined;
  const data = await loadBudgets(user.id, month);

  if (!data) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
        Tháng không hợp lệ.{" "}
        <Link href="/budgets" className="font-medium underline">
          Xem tháng này
        </Link>
      </p>
    );
  }

  const [{ month: current, items }, categories] = data;
  const expenseCategories = categories.filter((category) => category.type === "EXPENSE");

  return (
    <>
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Ngân sách</h1>
        <p className="mt-1 text-[var(--dash-muted)]">
          Cảnh báo khi một danh mục dùng tới 80% hạn mức, và khi vượt 100%.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/budgets?month=${addMonths(current, -1)}`}
            aria-label="Tháng trước"
            className={monthButton}
          >
            ‹
          </Link>
          <h2 className="min-w-36 text-center text-lg font-medium">{monthLabel(current)}</h2>
          <Link
            href={`/budgets?month=${addMonths(current, 1)}`}
            aria-label="Tháng sau"
            className={monthButton}
          >
            ›
          </Link>
        </div>
      </div>
      <BudgetForm month={current} categories={expenseCategories} />
      <BudgetList items={items} />
    </>
  );
}
