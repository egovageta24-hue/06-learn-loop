import { signOut } from "@/auth";

/** Clears a stale session (e.g. the account was suspended) and returns to the login page. */
export async function GET() {
  await signOut({ redirectTo: "/login?reason=signed-out" });
}
