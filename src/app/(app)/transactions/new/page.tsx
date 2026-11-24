import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TransactionForm } from "@/components/transactions/transaction-form";
import { getCurrentUser } from "@/server/auth/session";
import { listSelectableCategories } from "@/server/categories/service";
import { getTodayKeyForUser } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Thêm giao dịch" };

export default function NewTransactionPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Thêm giao dịch</h1>
        <Link
          href="/"
          className="text-sm font-medium text-emerald-800 underline dark:text-emerald-400"
        >
          Về trang chủ
        </Link>
      </header>
      {/* Categories and "today" depend on the signed-in user, so they stream in. */}
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Đang tải…</p>}>
        <FormLoader />
      </Suspense>
    </main>
  );
}

async function FormLoader() {
  const user = await getCurrentUser();
  const [categories, today] = await Promise.all([
    listSelectableCategories(user.id),
    getTodayKeyForUser(user.id),
  ]);
  return <TransactionForm categories={categories} today={today} />;
}
