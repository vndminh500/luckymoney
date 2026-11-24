"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean };

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Tổng quan",
    exact: true,
    icon: (
      <svg {...iconProps}>
        <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Thống kê",
    icon: (
      <svg {...iconProps}>
        <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Giao dịch",
    icon: (
      <svg {...iconProps}>
        <path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 13l-4 4 4 4" />
      </svg>
    ),
  },
  {
    href: "/budgets",
    label: "Ngân sách",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5V12l6 6" />
      </svg>
    ),
  },
  {
    href: "/categories",
    label: "Danh mục",
    icon: (
      <svg {...iconProps}>
        <path d="M3.5 12.5 11 5h7.5a1 1 0 0 1 1 1v7.5L12 21z" />
        <circle cx="15.5" cy="8.5" r="1.3" />
      </svg>
    ),
  },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (pathname === null) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Logo and the app's sections. On small screens it lives in a slide-in drawer. */
function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-5">
      <Link href="/" aria-label="Lucky Money, trang tổng quan" className="rounded-lg px-2">
        <Logo />
      </Link>
      <nav aria-label="Chính">
        {/* The current page is URL data: highlight it once known, show the menu meanwhile. */}
        <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
          <CurrentNavList onNavigate={onNavigate} />
        </Suspense>
      </nav>
    </div>
  );
}

function CurrentNavList({ onNavigate }: { onNavigate: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-[var(--dash-muted)] transition-colors duration-200 hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:bg-lm-sky/15 aria-[current=page]:text-[var(--dash-text)]"
            >
              {/* Accent bar of the current section; grows in when it becomes active. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-2 left-0 w-1 origin-center rounded-full bg-lm-sky transition-transform duration-300 ease-lm ${
                  active ? "scale-y-100" : "scale-y-0"
                }`}
              />
              <span className="transition-transform duration-200 ease-lm group-hover:scale-110 group-aria-[current=page]:text-lm-deep dark:group-aria-[current=page]:text-lm-aqua">
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Frame of every signed-in page: a left sidebar with the sections and a top bar
 * that only holds sign-out. Below `lg` the sidebar becomes a drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="dash-shell flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-[var(--dash-border)] bg-[var(--dash-surface)] lg:block">
        <Sidebar onNavigate={close} />
      </aside>

      {/* Mobile drawer */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-lm-ink/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id="app-drawer"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[0_20px_60px_rgb(6_43_69/0.25)] transition-[transform,visibility] duration-300 ease-lm lg:hidden ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Sidebar onNavigate={close} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--dash-border)] bg-[var(--dash-surface)]/80 px-4 py-3 backdrop-blur lg:justify-end">
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="app-drawer"
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-[var(--dash-border)] transition-colors hover:border-lm-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep lg:hidden"
          >
            <svg {...iconProps}>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link href="/" aria-label="Lucky Money, trang tổng quan" className="mr-auto lg:hidden">
            <Logo />
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 font-medium whitespace-nowrap transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98] sm:px-4"
            >
              <svg {...iconProps}>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
              </svg>
              <span className="sr-only sm:not-sr-only">Đăng xuất</span>
            </button>
          </form>
        </header>
        {children}
      </div>
    </div>
  );
}
