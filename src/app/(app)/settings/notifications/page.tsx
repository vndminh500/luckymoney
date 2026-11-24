import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsCard } from "@/components/settings/choice-group";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Thông báo" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p className="text-[var(--dash-muted)]">Đang tải…</p>}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  const user = await getCurrentUser();
  const { notifyBudgetWarning, notifyBudgetOver, notifyDebtEmail } = await getPreferences(user.id);
  return (
    <SettingsCard title="Thông báo">
      <NotificationsForm
        notifyBudgetWarning={notifyBudgetWarning}
        notifyBudgetOver={notifyBudgetOver}
        notifyDebtEmail={notifyDebtEmail}
      />
    </SettingsCard>
  );
}
