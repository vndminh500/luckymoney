import type { ReactNode } from "react";

import { SectionTabs } from "@/components/ui/section-tabs";

const TABS = [
  { href: "/account", label: "Thông tin cá nhân" },
  { href: "/account/security", label: "Bảo mật" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.01em]">Tài khoản</h1>
      <SectionTabs tabs={TABS} label="Mục tài khoản" />
      {children}
    </main>
  );
}
