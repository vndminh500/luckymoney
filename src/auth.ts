import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

import { findUserIdByAccount, resolveGoogleUser } from "@/server/auth/google";
import { verifyCredentials } from "@/server/auth/users";

/** Sessions expire after 7 days (PRD F1: "phiên đăng nhập có hạn"). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Google sign-in is offered only when its credentials are configured (see .env.example). */
export const isGoogleSignInEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: (credentials) => verifyCredentials(credentials),
  }),
];
if (isGoogleSignInEnabled) {
  // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
  providers.push(Google);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Stateless JWT sessions stored in an encrypted, httpOnly cookie (no Session table).
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  // Auth.js sends sign-in errors here as ?error=<code>; the login page explains them.
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }
      const result = await resolveGoogleUser(profile);
      if (result.ok) {
        return true;
      }
      const error =
        result.reason === "ACCOUNT_NOT_LINKED" ? "OAuthAccountNotLinked" : "AccessDenied";
      return `/login?error=${error}`;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        // `user.id` is Google's id here; switch to our user id, linked in signIn above.
        const userId = await findUserIdByAccount("google", account.providerAccountId);
        if (!userId) {
          throw new Error("Google account is not linked to a user");
        }
        token.sub = userId;
      } else if (user?.id) {
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
