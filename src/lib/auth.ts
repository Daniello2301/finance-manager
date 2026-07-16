import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider, {
  type GoogleProfile,
} from "next-auth/providers/google";
import { verifyCredentials } from "@/lib/auth/verifyCredentials";
import { findOrCreateGoogleUser } from "@/lib/auth/googleUser";

/**
 * NextAuth v4's Credentials provider only supports the JWT session
 * strategy (database sessions require an OAuth-style linked account,
 * which credentials logins don't have — CALLBACK_CREDENTIALS_JWT_ERROR
 * otherwise). No adapter is used: user records are owned by our own
 * Mongoose User model, not by NextAuth. That stays true with Google —
 * see the signIn callback.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return verifyCredentials(credentials.email, credentials.password);
      },
    }),
    // Added alongside credentials, never in place of them (ratified 2026-07-16).
    // Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET at runtime.
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Where a Google identity becomes OUR user.
     *
     * Everything that matters happens here rather than in `jwt`, because this
     * is the only callback that can REFUSE a sign-in by returning false.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const googleProfile = profile as GoogleProfile | undefined;
      // Google not vouching for the address means we cannot match it to an
      // existing account — that would hand someone else's money to whoever
      // typed their address into a fresh Google account (FR-017).
      if (!googleProfile?.email_verified || !googleProfile.email) return false;

      const resolved = await findOrCreateGoogleUser({
        // Google's stable `sub`. It is a LINK, never the identity.
        googleId: account.providerAccountId,
        email: googleProfile.email,
        name: googleProfile.name ?? googleProfile.email,
        emailVerified: true,
      });
      if (!resolved) return false;

      // The load-bearing line: hand our own ObjectId to the jwt callback below.
      // If Google's `sub` reached session.user.id, every `{ userId }` query in
      // the app — all seven collections hang off it (Principle 8) — would look
      // for a user that doesn't exist. This is the difference between adding a
      // provider and swapping out the identity model.
      user.id = resolved.id;
      return true;
    },
    async jwt({ token, user }) {
      // Unchanged, and it works for both providers precisely because signIn
      // above already normalised `user.id` to our own.
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
