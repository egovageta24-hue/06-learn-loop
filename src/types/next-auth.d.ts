import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface User {
    role: Role;
    orgId: string;
  }
  interface Session {
    user: { id: string; role: Role; orgId: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    orgId: string;
  }
}
