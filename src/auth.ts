import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticate } from "@/server/auth/users";
import { clientIp, RateLimitedError } from "@/server/rate-limit";

/** Sessions expire after 7 days (PRD F1: "phiên đăng nhập có hạn"). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** `code` of the sign-in error raised past the login rate limits. */
export const RATE_LIMITED_SIGN_IN = "rate_limited";

class TooManySignInAttempts extends CredentialsSignin {
  code = RATE_LIMITED_SIGN_IN;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Stateless JWT sessions stored in an encrypted, httpOnly cookie (no Session table).
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  // Auth.js sends sign-in errors here as ?error=<code>; the login page explains them.
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        try {
          return await authenticate(credentials, clientIp(request.headers));
        } catch (error) {
          if (error instanceof RateLimitedError) {
            throw new TooManySignInAttempts();
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
