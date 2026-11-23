import { NextResponse } from "next/server";

import { auth } from "@/auth";

/** Pages that guests may open. Signed-in users are sent home from these. */
const GUEST_PAGES = ["/login", "/register"];

/** API paths that work without a session (Auth.js endpoints and registration). */
const PUBLIC_API_PREFIX = "/api/auth/";

/**
 * First, optimistic auth check that keeps guests out of app pages.
 * It is not the security boundary: route handlers and server actions check the
 * session again through src/server/auth/session.ts.
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isSignedIn = Boolean(request.auth?.user?.id);

  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  if (GUEST_PAGES.includes(pathname)) {
    return isSignedIn ? NextResponse.redirect(new URL("/", request.nextUrl)) : NextResponse.next();
  }

  if (isSignedIn) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Bạn cần đăng nhập." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.nextUrl);
  if (pathname !== "/") {
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Skip Next.js internals and static files from /public.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
