"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export type SectionTab = { href: string; label: string };

function TabList({
  tabs,
  pathname,
  label,
}: {
  tabs: SectionTab[];
  pathname: string | null;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-[var(--dash-border)]"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative shrink-0 px-4 py-2.5 font-medium whitespace-nowrap text-[var(--dash-muted)] transition-colors duration-200 hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:text-[var(--dash-text)]"
          >
            {tab.label}
            {/* Underline of the current section; grows in when it becomes active. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-3 -bottom-px h-0.5 origin-center rounded-full bg-lm-sky transition-transform duration-300 ease-lm ${
                active ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function CurrentTabList(props: { tabs: SectionTab[]; label: string }) {
  return <TabList {...props} pathname={usePathname()} />;
}

/** Second-level navigation of a section (Account, Settings). */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  return (
    // The current path is URL data: show the tabs right away, mark the current one once known.
    <Suspense fallback={<TabList tabs={tabs} pathname={null} label={label} />}>
      <CurrentTabList tabs={tabs} label={label} />
    </Suspense>
  );
}
