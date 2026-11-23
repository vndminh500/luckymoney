import { Suspense } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/server/auth/session";

// Temporary signed-in home page. The monthly dashboard replaces it in T13.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-xl font-semibold tracking-tight text-emerald-800 dark:text-emerald-400">
          Spendly
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Đăng xuất
          </button>
        </form>
      </header>
      {/* Reading the session is request data, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Đang tải…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <section>
      <h1 className="text-2xl font-semibold">Xin chào, {user.name ?? user.email}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Bạn đã đăng nhập bằng {user.email}.</p>
    </section>
  );
}
