import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FormAlert } from "@/components/ui/form";
import { TransactionList } from "@/components/transactions/transaction-list";
import { getCurrentUser } from "@/server/auth/session";
import { listSelectableCategories } from "@/server/categories/service";
import { ValidationError } from "@/server/errors";
import { listTransactions } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Giao dịch" };

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Giao dịch</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-emerald-800 underline dark:text-emerald-400"
          >
            Trang chủ
          </Link>
          <Link
            href="/transactions/new"
            className="inline-flex h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Thêm giao dịch
          </Link>
        </div>
      </header>
      {/* The list depends on the user and the URL, so it streams in. */}
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Đang tải…</p>}>
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
    return await Promise.all([listTransactions(userId, query), listSelectableCategories(userId)]);
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
  const data = await loadList(user.id, query);
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <FormAlert>Bộ lọc không hợp lệ.</FormAlert>
        <Link
          href="/transactions"
          className="text-sm font-medium text-emerald-800 underline dark:text-emerald-400"
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
  return <TransactionList result={result} filters={filters} categories={categories} />;
}
