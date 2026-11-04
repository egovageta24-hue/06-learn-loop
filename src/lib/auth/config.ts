import type { NextAuthConfig } from "next-auth";
import { homeFor, type Role } from "./roles";

/**
 * Edge-safe half of the Auth.js config (no DB, no bcrypt) so the proxy can use
 * it. This is only the coarse first gate — every query and action re-checks the
 * user against the database via `requireUser()` / `requireRole()`.
 */
const SIGNED_IN_PREFIXES = ["/dashboard", "/progress", "/learn", "/instructor", "/admin"];
const GUEST_ONLY = ["/login", "/register"];

const startsWith = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // Credentials provider is added in src/auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const user = auth?.user;

      if (GUEST_ONLY.some((p) => startsWith(path, p))) {
        return user ? Response.redirect(new URL(homeFor(user.role as Role), nextUrl)) : true;
      }

      if (!SIGNED_IN_PREFIXES.some((p) => startsWith(path, p))) return true;
      if (!user) return false; // Auth.js redirects to /login?callbackUrl=…

      const role = user.role as Role;
      if (startsWith(path, "/admin") && role !== "admin") {
        return Response.redirect(new URL(homeFor(role), nextUrl));
      }
      if (startsWith(path, "/instructor") && role === "learner") {
        return Response.redirect(new URL(homeFor(role), nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.orgId = user.orgId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.orgId = token.orgId;
      return session;
    },
  },
} satisfies NextAuthConfig;
