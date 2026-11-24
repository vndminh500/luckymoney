import { LoadingState } from "@/components/ui/loading-state";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsCard } from "@/components/settings/choice-group";
import { ThemePicker } from "@/components/settings/theme-picker";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/settings/service";

export const metadata: Metadata = { title: "Giao diện" };

export default function AppearancePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Appearance />
    </Suspense>
  );
}

async function Appearance() {
  const user = await getCurrentUser();
  const { theme } = await getPreferences(user.id);
  return (
    <SettingsCard title="Giao diện">
      <ThemePicker initial={theme} />
    </SettingsCard>
  );
}
