import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DebtForm } from "@/components/debts/debt-form";
import { getCurrentUser } from "@/server/auth/session";
import { getDebt, todayForUser } from "@/server/debts/service";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "Sửa khoản nợ" };

export default function EditDebtPage({ params }: PageProps<"/debts/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Sửa khoản nợ</h1>
      <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
        <EditDebt params={params} />
      </Suspense>
    </main>
  );
}

async function EditDebt({ params }: Pick<PageProps<"/debts/[id]/edit">, "params">) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  const today = await todayForUser(user.id);
  const debt = await getDebt(user.id, id, today).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return (
    <DebtForm
      debtId={debt.id}
      today={today}
      initial={{
        direction: debt.direction,
        counterparty: debt.counterparty,
        principal: debt.status.principal,
        startDate: debt.startDate,
        note: debt.note,
        installments: debt.status.installments.map(({ dueDate, amount }) => ({ dueDate, amount })),
      }}
    />
  );
}
