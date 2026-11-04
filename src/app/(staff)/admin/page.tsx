import { BookOpen, GraduationCap, ListChecks, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/brand/progress";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { getOrgSummary } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Organization overview" };

export default async function AdminOverview() {
  const admin = await requireRole("admin");
  const sum = await getOrgSummary(admin.orgId);

  const people = (sum.roles.learner ?? 0) + (sum.roles.instructor ?? 0) + (sum.roles.admin ?? 0);
  const completionRate = sum.enrollments > 0 ? Math.round((sum.completions / sum.enrollments) * 100) : 0;

  const tiles = [
    { icon: Users, label: "Active people", value: people, note: `${sum.roles.learner ?? 0} learners · ${sum.roles.instructor ?? 0} instructors · ${sum.roles.admin ?? 0} admins` },
    { icon: BookOpen, label: "Published courses", value: sum.courses.published ?? 0, note: `${sum.courses.draft ?? 0} drafts · ${sum.courses.archived ?? 0} archived` },
    { icon: GraduationCap, label: "Enrollments", value: sum.enrollments, note: `${sum.activeLearners7d} learners active in the last 7 days` },
    { icon: ListChecks, label: "Quiz attempts", value: sum.quizAttempts, note: sum.quizPassRate === null ? "No attempts yet" : `${sum.quizPassRate}% of attempts passed` },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Organization overview</h1>
        <p className="text-muted-foreground">People, courses and learning activity across your organization.</p>
      </header>

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <t.icon className="size-4" aria-hidden /> {t.label}
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="completion-heading" className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 id="completion-heading" className="text-lg font-bold">
          Course completion
        </h2>
        <ProgressBar value={completionRate} label="Enrollments completed" showValue />
        <p className="text-sm text-muted-foreground">
          {sum.completions} of {sum.enrollments} enrollments have finished their course.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/admin/users" className={buttonVariants({ size: "xl" })}>
          Manage users
        </Link>
        <Link href="/admin/courses" className={buttonVariants({ size: "xl", variant: "outline" })}>
          Manage courses
        </Link>
      </section>
    </main>
  );
}
