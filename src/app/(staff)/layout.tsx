import { SiteHeader } from "@/components/app/site-header";
import { requireRole } from "@/lib/auth/session";

// Coarse gate for everything under /instructor and /admin. Admin-only pages
// and per-course ownership are enforced again where the data is loaded.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("instructor", "admin");
  return (
    <>
      <SiteHeader user={user} />
      <div className="flex-1">{children}</div>
    </>
  );
}
