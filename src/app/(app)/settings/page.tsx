import { LoadingState } from "@/components/ui/loading-state";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsCard } from "@/components/settings/choice-group";
import { DisplayForm } from "@/components/settings/display-form";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/settings/service";
import { getTodayKeyForUser } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Tùy chỉnh tài chính" };

export default function FinanceSettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FinanceSettings />
    </Suspense>
  );
}

async function FinanceSettings() {
  const user = await getCurrentUser();
  const [preferences, today] = await Promise.all([
    getPreferences(user.id),
    getTodayKeyForUser(user.id),
  ]);
  // Every IANA zone the runtime knows, with the user's current one kept even if it is an alias.
  const zones = Intl.supportedValuesOf("timeZone");
  const timeZones = zones.includes(preferences.timeZone) ? zones : [preferences.timeZone, ...zones];
  return (
    <SettingsCard title="Tùy chỉnh tài chính">
      <DisplayForm preferences={preferences} timeZones={timeZones} today={today} />
    </SettingsCard>
  );
}
