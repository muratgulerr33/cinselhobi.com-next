import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/connection";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import "@/types/auth";
import authConfig from "./auth.config";

// ENV kontrolü (dev için)
if (!process.env.AUTH_SECRET) {
  console.warn("⚠️ Missing AUTH_SECRET");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  debug: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (user.length === 0 || !user[0].passwordHash) {
          return null;
        }

        const isValid = await argon2.verify(
          user[0].passwordHash,
          credentials.password as string
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          image: user[0].image,
          role: user[0].role ?? undefined,
        };
      },
    }),
  ],
});

