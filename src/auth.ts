import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyCredentials } from "@/server/auth/users";

/** Sessions expire after 7 days (PRD F1: "phiên đăng nhập có hạn"). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Stateless JWT sessions stored in an encrypted, httpOnly cookie (no Session table).
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  // Auth.js sends sign-in errors here as ?error=<code>; the login page explains them.
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => verifyCredentials(credentials),
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
