import { LoadingState } from "@/components/ui/loading-state";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AvatarUploader } from "@/components/account/avatar-uploader";
import { ProfileForm } from "@/components/account/profile-form";
import { getAccount } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/session";
import { getTodayKeyForUser } from "@/server/transactions/service";

export const metadata: Metadata = { title: "Thông tin cá nhân" };

const card =
  "animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6";

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await getCurrentUser();
  const [account, today] = await Promise.all([getAccount(user.id), getTodayKeyForUser(user.id)]);
  return (
    <>
      <section aria-labelledby="avatar-heading" className={card}>
        <h2 id="avatar-heading" className="mb-4 text-lg font-bold">
          Ảnh đại diện
        </h2>
        <AvatarUploader
          name={account.name}
          email={account.email}
          avatarVersion={account.avatarVersion}
        />
      </section>
      <section aria-labelledby="profile-heading" className={card}>
        <h2 id="profile-heading" className="mb-4 text-lg font-bold">
          Thông tin cá nhân
        </h2>
        <ProfileForm
          name={account.name}
          username={account.username}
          birthDate={account.birthDate}
          email={account.email}
          googleLinked={account.googleLinked}
          today={today}
        />
      </section>
    </>
  );
}
