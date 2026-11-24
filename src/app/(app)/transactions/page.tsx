import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TransactionList } from "@/components/transactions/transaction-list";
import { BrandAlert, brandPrimaryButton } from "@/components/ui/brand-form";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/settings/service";
import { listCategories } from "@/server/categories/service";
import { ValidationError } from "@/server/errors";
import { listTransactions } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Giao dịch" };

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Giao dịch</h1>
        <Link href="/transactions/new" className={brandPrimaryButton}>
          Thêm giao dịch
        </Link>
      </div>
      {/* The list depends on the user and the URL, so it streams in. */}
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <ListLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** First value of each query parameter, as the service expects plain strings. */
function firstValues(params: Record<string, string | string[] | undefined>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) {
      result[key] = first;
    }
  }
  return result;
}

/** Loads the page data, or null when the URL holds an invalid filter. */
async function loadList(userId: string, query: Record<string, string>) {
  try {
    // The filter also offers archived categories: old transactions still use them.
    return await Promise.all([
      listTransactions(userId, query),
      listCategories(userId, { includeArchived: "true" }),
    ]);
  } catch (error) {
    if (error instanceof ValidationError) {
      return null;
    }
    throw error;
  }
}

async function ListLoader({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  const user = await getCurrentUser();
  const query = firstValues(await searchParams);
  const [data, display] = await Promise.all([loadList(user.id, query), getPreferences(user.id)]);
  if (!data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BrandAlert>Bộ lọc không hợp lệ.</BrandAlert>
        <Link
          href="/transactions"
          className="font-medium text-lm-deep underline underline-offset-4 dark:text-lm-aqua"
        >
          Xem tháng này
        </Link>
      </div>
    );
  }
  const [result, categories] = data;
  const filters = {
    month: result.month,
    type: query.type || undefined,
    categoryId: query.categoryId || undefined,
    page: result.page,
  };
  return (
    <TransactionList result={result} filters={filters} categories={categories} display={display} />
  );
}
