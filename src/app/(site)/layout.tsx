import Link from "next/link";
import { SiteHeader } from "@/components/app/site-header";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <div className="flex-1">{children}</div>
      <footer className="border-t bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <p>Guided professional learning — always one clear next step.</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/courses" className="hover:text-foreground">
              Catalog
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
