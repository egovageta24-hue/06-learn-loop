import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Coarse route gate only (signed in? right role family?). Data access is
// authorised again in the query/action layer.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
