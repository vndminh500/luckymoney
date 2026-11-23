import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Đăng nhập" };

/**
 * The page waits for searchParams on the server instead of streaming part of the
 * form behind Suspense. A streamed hidden input was briefly removed and re-added
 * by React after load, so a quick submit could lose callbackUrl. The login page
 * does not need instant navigation, so blocking here is the simpler, safe choice.
 */
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const safe = safeRedirectPath(callbackUrl, "");

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Đăng nhập</h1>
      <LoginForm callbackUrl={safe || undefined} />
    </>
  );
}
