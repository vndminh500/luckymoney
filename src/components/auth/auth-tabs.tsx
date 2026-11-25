"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const TABS = [
  { href: "/login", label: "Đăng nhập" },
  { href: "/register", label: "Đăng ký" },
] as const;

/**
 * Switch between sign-in and sign-up. The layout keeps this mounted across the
 * two routes, so the pill slides from one tab to the other.
 */
export function AuthTabs() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex((tab) => tab.href === pathname);
  // Other auth pages (forgot / reset password) are neither tab.
  if (activeIndex === -1) {
    return null;
  }

  return (
    <nav
      aria-label="Tài khoản"
      className="relative mb-8 grid grid-cols-2 rounded-full bg-[var(--auth-tab-track)] p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--auth-tab-pill)] shadow-[0_1px_2px_rgb(6_43_69/0.08),0_4px_12px_color-mix(in_srgb,var(--lm-sky)_18%,transparent)] transition-transform duration-300 ease-lm"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {TABS.map((tab, index) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={index === activeIndex ? "page" : undefined}
          className="relative z-10 rounded-full py-2.5 text-center font-medium text-[var(--auth-muted)] transition-colors duration-300 hover:text-[var(--auth-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:text-[var(--auth-text)]"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Replays the rise animation whenever the route changes, so the new form eases
 * in. The forms differ in height and the auth column is centered, so the box
 * animates its height to the new content: the tabs above glide instead of jump.
 */
export function AuthTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-testid="auth-height"
      style={{ height }}
      className="transition-[height] duration-[420ms] ease-lm motion-reduce:transition-none"
    >
      <div ref={contentRef}>
        <div key={pathname} className="animate-lm-rise">
          {children}
        </div>
      </div>
    </div>
  );
}
