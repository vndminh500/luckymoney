import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteTransactionAction, updateTransactionAction } from "@/app/(app)/transactions/actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { toDateKey } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth/session";
import { listSelectableCategories } from "@/server/categories/service";
import { NotFoundError } from "@/server/errors";
import { getTodayKeyForUser, getTransaction, getUserTimeZone } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Sửa giao dịch" };

export default function EditTransactionPage({ params }: PageProps<"/transactions/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Sửa giao dịch</h1>
        <Link
          href="/transactions"
          className="text-sm font-medium text-emerald-800 underline dark:text-emerald-400"
        >
          Về danh sách
        </Link>
      </header>
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Đang tải…</p>}>
        <EditLoader params={params} />
      </Suspense>
    </main>
  );
}

/** The user's transaction, or a 404 page for another user's, unknown or deleted id. */
async function loadTransaction(userId: string, id: string) {
  try {
    return await getTransaction(userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}

async function EditLoader({ params }: Pick<PageProps<"/transactions/[id]/edit">, "params">) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  const transaction = await loadTransaction(user.id, id);
  const [selectable, timeZone, today] = await Promise.all([
    listSelectableCategories(user.id),
    getUserTimeZone(user.id),
    getTodayKeyForUser(user.id),
  ]);

  // An archived category can no longer be picked, but the transaction keeps it.
  const { category } = transaction;
  const categories = category.archived
    ? [
        ...selectable,
        {
          id: category.id,
          name: `${category.name} (đã lưu trữ)`,
          type: transaction.type,
          icon: category.icon,
        },
      ]
    : selectable;

  const date = toDateKey(transaction.occurredAt, timeZone);
  const initialValues = {
    type: transaction.type,
    amount: String(transaction.amount),
    categoryId: category.id,
    date,
    note: transaction.note ?? "",
  };

  return (
    <div className="flex flex-col gap-8">
      <TransactionForm
        categories={categories}
        today={today}
        action={updateTransactionAction.bind(null, id)}
        initialValues={initialValues}
        submitLabel="Lưu thay đổi"
        autoFocusAmount={false}
      />
      <form
        action={deleteTransactionAction.bind(null, id)}
        className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <input type="hidden" name="month" value={date.slice(0, 7)} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Giao dịch đã xóa không còn trong danh sách và thống kê.
        </p>
        <button
          type="submit"
          className="h-11 rounded-lg border border-red-300 px-4 font-medium text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          Xóa giao dịch
        </button>
      </form>
    </div>
  );
}
