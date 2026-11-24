import Link from "next/link";

import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";

const navLink =
  "rounded-lg px-3 py-2 font-medium text-[var(--dash-muted)] transition-colors duration-200 hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep aria-[current=page]:text-[var(--dash-text)]";

const LINKS = [
  { href: "/transactions", label: "Giao dịch" },
  { href: "/budgets", label: "Ngân sách" },
  { href: "/categories", label: "Danh mục" },
] as const;

/** Top bar of the brand-styled app pages (inside `.dash-shell`). */
export function AppHeader({ current }: { current?: (typeof LINKS)[number]["href"] }) {
  return (
    <header className="border-b border-[var(--dash-border)] bg-[var(--dash-surface)]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="Lucky Money, trang tổng quan" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Chính" className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
              className={navLink}
            >
              {link.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button type="submit" className={navLink}>
              Đăng xuất
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
