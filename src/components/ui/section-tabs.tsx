"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

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
      className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[var(--dash-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`absolute inset-x-3 bottom-0 h-0.5 origin-center rounded-full bg-lm-sky transition-transform duration-300 ease-lm ${
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
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // On narrow screens the tabs scroll sideways without a scrollbar, so bring
  // the current one into view instead of leaving it hidden off the edge.
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <div ref={ref}>
      <TabList {...props} pathname={pathname} />
    </div>
  );
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
