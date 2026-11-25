import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/** Pages that guests may open. Signed-in users are sent home from these. */
const GUEST_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

/** API paths that work without a session (Auth.js endpoints and registration). */
const PUBLIC_API_PREFIX = "/api/auth/";

/**
 * True when the request carries a valid, unexpired session cookie.
 *
 * The proxy only decodes the cookie and never writes one. Auth.js' `auth()`
 * proxy wrapper re-issues the session cookie on every response, so a request
 * that was in flight during sign-out (e.g. a link prefetch) put the cookie back
 * and signed the user in again. Sessions therefore have a fixed lifetime
 * (SESSION_MAX_AGE_SECONDS from sign-in) instead of a rolling one.
 */
async function hasSession(request: NextRequest): Promise<boolean> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // Same rule as Auth.js: "__Secure-" cookie names on https.
    secureCookie: request.nextUrl.protocol === "https:",
  });
  return Boolean(token?.sub);
}

/**
 * First, optimistic auth check that keeps guests out of app pages.
 * It is not the security boundary: route handlers and server actions check the
 * session again through src/server/auth/session.ts.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  const isSignedIn = await hasSession(request);

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
}

export const config = {
  // Skip Next.js internals, static files from /public and the installable-app
  // files (manifest, service worker, offline page, Android asset links), which
  // guests and the Android app must reach without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon\.ico|manifest\.webmanifest|sw\.js|offline\.html|\.well-known/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
