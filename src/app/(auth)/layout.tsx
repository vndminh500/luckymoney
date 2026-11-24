import type { ReactNode } from "react";

import { AuthTabs, AuthTransition } from "@/components/auth/auth-tabs";
import { BrandPanel } from "@/components/auth/brand-panel";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <main className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        {/* A soft wash of the palette behind the form on small screens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-lm-aqua/40 blur-3xl lg:hidden"
        />
        <div className="relative w-full max-w-[400px] animate-lm-rise">
          <Logo className="mb-10 lg:hidden" />
          <AuthTabs />
          <AuthTransition>{children}</AuthTransition>
        </div>
      </main>
    </div>
  );
}
