import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/** Every signed-in page shares the sidebar and top bar, kept mounted across navigation. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
