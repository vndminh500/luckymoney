import { LoadingState } from "@/components/ui/loading-state";
import type { Metadata } from "next";
import { Suspense } from "react";

import { DebtForm } from "@/components/debts/debt-form";
import { getCurrentUser } from "@/server/auth/session";
import { todayForUser } from "@/server/debts/service";

export const metadata: Metadata = { title: "Thêm khoản nợ" };

export default function NewDebtPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Thêm khoản nợ</h1>
      <Suspense fallback={<LoadingState />}>
        <NewDebt />
      </Suspense>
    </main>
  );
}

async function NewDebt() {
  const user = await getCurrentUser();
  return <DebtForm debtId={null} initial={null} today={await todayForUser(user.id)} />;
}
