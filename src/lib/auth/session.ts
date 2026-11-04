import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { homeFor, type Role } from "./roles";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
}

/**
 * The database — not the JWT — is authoritative for who a user is right now,
 * so a role change or suspension takes effect on the very next request.
 * Returns `invalid` when a token exists but its user is gone/suspended.
 */
const resolveUser = cache(
  async (): Promise<{ user: CurrentUser | null; invalid: boolean }> => {
    const session = await auth();
    if (!session?.user?.id) return { user: null, invalid: false };

    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        orgId: users.orgId,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!row || row.status !== "active") return { user: null, invalid: true };
    return { user: { id: row.id, name: row.name, email: row.email, role: row.role, orgId: row.orgId }, invalid: false };
  },
);

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await resolveUser()).user;
}

export async function requireUser(): Promise<CurrentUser> {
  const { user, invalid } = await resolveUser();
  if (user) return user;
  // A stale token for a suspended/deleted user must be cleared, otherwise the
  // proxy (which sees a "signed in" token) and this check would redirect forever.
  redirect(invalid ? "/auth/signed-out" : "/login");
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
