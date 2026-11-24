import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddCategoryForm, CategoryRow } from "@/components/categories/category-manager";
import { getCurrentUser } from "@/server/auth/session";
import { listCategories, type CategoryDto } from "@/server/categories/service";

export const metadata: Metadata = { title: "Danh mục" };

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Danh mục</h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className="text-emerald-800 underline dark:text-emerald-400">
            Trang chủ
          </Link>
          <Link href="/transactions" className="text-emerald-800 underline dark:text-emerald-400">
            Giao dịch
          </Link>
        </div>
      </header>
      <AddCategoryForm />
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Đang tải…</p>}>
        <CategoryLists />
      </Suspense>
    </main>
  );
}

async function CategoryLists() {
  const user = await getCurrentUser();
  const categories = await listCategories(user.id, { includeArchived: "true" });
  const active = categories.filter((category) => !category.archived);
  const groups: { title: string; items: CategoryDto[]; empty: string }[] = [
    {
      title: "Chi",
      items: active.filter((category) => category.type === "EXPENSE"),
      empty: "Chưa có danh mục chi.",
    },
    {
      title: "Thu",
      items: active.filter((category) => category.type === "INCOME"),
      empty: "Chưa có danh mục thu.",
    },
    {
      title: "Đã lưu trữ",
      items: categories.filter((category) => category.archived),
      empty: "Không có danh mục nào được lưu trữ.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.title === "Đã lưu trữ" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Không chọn được cho giao dịch mới, nhưng vẫn hiện trên các giao dịch cũ.
            </p>
          ) : null}
          {group.items.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{group.empty}</p>
          ) : (
            <ul
              aria-label={`Danh mục ${group.title.toLowerCase()}`}
              className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
            >
              {group.items.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
