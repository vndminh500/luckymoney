import { LoadingState } from "@/components/ui/loading-state";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AddCategoryForm, CategoryRow } from "@/components/categories/category-manager";
import { getCurrentUser } from "@/server/auth/session";
import { listCategories, type CategoryDto } from "@/server/categories/service";

export const metadata: Metadata = { title: "Danh mục" };

const card =
  "animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)]";

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Danh mục</h1>
        <p className="mt-1 text-[var(--dash-muted)]">
          Nhóm các khoản thu chi theo cách bạn quen gọi.
        </p>
      </div>
      <section aria-labelledby="add-heading" className={`${card} relative z-20 p-5 sm:p-6`}>
        <h2 id="add-heading" className="mb-5 text-lg font-bold">
          Thêm danh mục
        </h2>
        <AddCategoryForm />
      </section>
      <Suspense fallback={<LoadingState />}>
        <CategoryLists />
      </Suspense>
    </main>
  );
}

type Group = { title: string; items: CategoryDto[]; empty: string };

function GroupCard({ group }: { group: Group }) {
  return (
    <section className={`${card} relative focus-within:z-10`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--dash-border)] px-4 py-3 sm:px-5">
        <h2 className="text-lg font-bold">{group.title}</h2>
        <span className="text-sm text-[var(--dash-muted)] tabular-nums">
          {group.items.length} danh mục
        </span>
      </div>
      {group.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[var(--dash-muted)] sm:px-5">{group.empty}</p>
      ) : (
        <ul aria-label={`Danh mục ${group.title.toLowerCase()}`}>
          {group.items.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}
    </section>
  );
}

async function CategoryLists() {
  const user = await getCurrentUser();
  const categories = await listCategories(user.id);
  const [expense, income]: Group[] = [
    {
      title: "Chi",
      items: categories.filter((category) => category.type === "EXPENSE"),
      empty: "Chưa có danh mục chi.",
    },
    {
      title: "Thu",
      items: categories.filter((category) => category.type === "INCOME"),
      empty: "Chưa có danh mục thu.",
    },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <GroupCard group={expense} />
      <GroupCard group={income} />
    </div>
  );
}
