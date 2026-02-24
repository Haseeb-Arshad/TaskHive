import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { apiClient } from "@/lib/api-client";

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

        try {
          const res = await apiClient("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;
          const user = await res.json();

          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
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

      // Google OAuth sign-in: look up or create the user in our DB via Python backend
      if (account?.provider === "google" && profile) {
        const googleProfile = profile as {
          email?: string;
          name?: string;
          picture?: string;
        };
        const email = googleProfile.email ?? token.email ?? "";

        if (email) {
          try {
            const res = await apiClient("/api/auth/social-sync", {
              method: "POST",
              body: JSON.stringify({
                email,
                name: googleProfile.name,
                avatar_url: googleProfile.picture,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              token.userId = data.id;
            }
          } catch (error) {
            console.error("Social sync error:", error);
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days — match session.maxAge
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
