import Link from "next/link";
import { signOutAction } from "@/actions/auth";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { homeFor, roleLabel, type Role } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";

const NAV: Record<Role, { href: string; label: string; exact?: boolean }[]> = {
  learner: [
    { href: "/dashboard", label: "My learning" },
    { href: "/courses", label: "Catalog" },
    { href: "/progress", label: "Progress" },
  ],
  instructor: [
    { href: "/instructor", label: "Instructor", exact: true },
    { href: "/instructor/courses/new", label: "New course" },
    { href: "/courses", label: "Catalog" },
    { href: "/dashboard", label: "My learning" },
  ],
  admin: [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/instructor", label: "Instructor view" },
    { href: "/courses", label: "Catalog" },
  ],
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function SiteHeader({ user, className }: { user: CurrentUser | null; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-30 border-b bg-white/80 backdrop-blur", className)}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Logo href={user ? homeFor(user.role) : "/"} />

        <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          {user ? (
            NAV[user.role].map((item) => (
              <NavLink key={item.href} href={item.href} exact={item.exact}>
                {item.label}
              </NavLink>
            ))
          ) : (
            <NavLink href="/courses">Course catalog</NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-2 text-right sm:flex">
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <Badge variant="secondary" className="mt-0.5">
                    {roleLabel[user.role]}
                  </Badge>
                </div>
              </div>
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                {initials(user.name)}
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Sign in
              </Link>
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
