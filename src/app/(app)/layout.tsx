import { Suspense, type ReactNode } from "react";

import { UserMenu } from "@/components/account/user-menu";
import { AppShell } from "@/components/layout/app-shell";
import { getAccount } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/session";

/** Every signed-in page shares the sidebar and top bar, kept mounted across navigation. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      accountMenu={
        // The avatar needs the signed-in user: it streams in behind a same-size placeholder.
        <Suspense
          fallback={
            <span className="block size-10 animate-pulse rounded-xl bg-[var(--dash-track)]" />
          }
        >
          <AccountMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function AccountMenu() {
  const user = await getCurrentUser();
  const account = await getAccount(user.id);
  return (
    <UserMenu
      name={account.name}
      email={account.email}
      username={account.username}
      avatarVersion={account.avatarVersion}
    />
  );
}
