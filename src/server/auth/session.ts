import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { UnauthenticatedError } from "@/server/errors";

/**
 * Data Access Layer for the session. Every route handler and server action must
 * get the user id from here, never from the client. The proxy is only a first,
 * optimistic check (see Next.js "Data Security" guide).
 */

export async function getSessionUserId(): Promise<string | null> {
  // Auth.js creates a random CSRF token while reading the session, which Next.js
  // forbids during prerendering; mark this as request-time work first.
  await connection();
  const session = await auth();
  return session?.user?.id ?? null;
}

/** For route handlers and server actions: throws 401 when not signed in. */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new UnauthenticatedError();
  }
  return userId;
}

export type CurrentUser = { id: string; email: string; name: string | null };

/** For pages: redirects to /login when not signed in or when the user no longer exists. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    redirect("/login");
  }
  return user;
}
