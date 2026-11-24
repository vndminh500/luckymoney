import type { ReactNode } from "react";

import { SectionTabs } from "@/components/ui/section-tabs";

const TABS = [
  { href: "/settings", label: "Tùy chỉnh tài chính" },
  { href: "/settings/appearance", label: "Giao diện" },
  { href: "/settings/notifications", label: "Thông báo" },
  { href: "/settings/about", label: "Về ứng dụng" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Cài đặt</h1>
      <SectionTabs tabs={TABS} label="Mục cài đặt" />
      {children}
    </main>
  );
}
