import { SiteHeader } from "@/components/app/site-header";
import { requireUser } from "@/lib/auth/session";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <SiteHeader user={user} />
      <div className="flex-1">{children}</div>
    </>
  );
}
