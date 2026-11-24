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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/transactions"
          className="text-sm font-medium text-[var(--dash-muted)] underline-offset-4 hover:text-[var(--dash-text)] hover:underline"
        >
          Về danh sách
        </Link>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">
          Thêm giao dịch
        </h1>
      </div>
      <section className="animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6">
        {/* Categories and "today" depend on the signed-in user, so they stream in. */}
        <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
          <FormLoader />
        </Suspense>
      </section>
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
