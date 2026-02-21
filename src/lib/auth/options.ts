import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import { grantWelcomeBonus } from "@/lib/credits/ledger";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .limit(1);

        // No user found, or user signed up via Google (no password)
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // refresh token daily
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Credentials sign-in: user.id is the DB id (string)
      if (user && account?.provider === "credentials") {
        token.userId = Number(user.id);
      }

      // Google OAuth sign-in: look up or create the user in our DB
      if (account?.provider === "google" && profile) {
        const googleProfile = profile as {
          email?: string;
          name?: string;
          picture?: string;
        };
        const email = googleProfile.email ?? token.email ?? "";

        if (email) {
          const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existing) {
            token.userId = existing.id;
          } else {
            // First-time Google sign-in — create account + welcome bonus
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                name: googleProfile.name ?? email.split("@")[0],
                passwordHash: null,
                role: "both",
                creditBalance: 0,
                avatarUrl: googleProfile.picture ?? null,
              })
              .returning({ id: users.id });

            try {
              await grantWelcomeBonus(newUser.id);
            } catch (err) {
              console.error("Failed to grant welcome bonus for Google user:", err);
            }

            token.userId = newUser.id;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
