import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-2xl font-semibold tracking-tight text-emerald-800 dark:text-emerald-400">
          Spendly
        </p>
        {children}
      </div>
    </main>
  );
}
