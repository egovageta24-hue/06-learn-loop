import { formatDistanceToNow } from "date-fns";
import { Mail, PenLine, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/brand/progress";
import { StatusBadge } from "@/components/instructor/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { getInstructorOverview } from "@/lib/queries/instructor";

export const metadata: Metadata = { title: "Instructor dashboard" };

const STATUS_STYLE = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-700",
  archived: "bg-amber-100 text-amber-900",
} as const;

export default async function InstructorDashboard() {
  const user = await requireRole("instructor", "admin");
  const { courses, atRisk } = await getInstructorOverview(user);

  const learners = courses.reduce((n, c) => n + c.enrolled, 0);
  const weighted = learners ? Math.round(courses.reduce((n, c) => n + c.avgProgress * c.enrolled, 0) / learners) : 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Instructor dashboard</h1>
          <p className="text-muted-foreground">
            {user.role === "admin" ? "All courses in your organization." : "Your courses and the learners taking them."}
          </p>
        </div>
        <Link href="/instructor/courses/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" /> New course
        </Link>
      </header>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Courses", value: courses.length },
          { label: "Learners enrolled", value: learners },
          { label: "Average progress", value: `${weighted}%` },
          { label: "Learners at risk", value: atRisk.length },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{k.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="risk-heading" className="space-y-3">
        <div>
          <h2 id="risk-heading" className="text-xl font-bold">
            Learners who need help
          </h2>
          <p className="text-sm text-muted-foreground">
            Several failed attempts on a quiz, or no activity for two weeks.
          </p>
        </div>
        {atRisk.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-muted-foreground">
            Nobody is flagged right now — everyone is moving.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="text-right">Reach out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Link href={`/instructor/courses/${r.courseId}`} className="hover:underline">
                        {r.courseTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.status === "escalated" && (
                        <span className="ml-2 text-xs text-muted-foreground">{r.failedAttempts} failed attempts</span>
                      )}
                    </TableCell>
                    <TableCell className="w-44">
                      <ProgressBar value={r.percent} label={`${r.name} progress`} showValue />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDistanceToNow(r.lastActivityAt, { addSuffix: true })}</TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`mailto:${r.email}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                        aria-label={`Email ${r.name}`}
                      >
                        <Mail data-icon="inline-start" /> Email
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="courses-heading" className="space-y-3">
        <h2 id="courses-heading" className="text-xl font-bold">
          Courses
        </h2>
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
            <p className="font-semibold">You haven&apos;t created a course yet.</p>
            <Link href="/instructor/courses/new" className={buttonVariants({ size: "lg", className: "mt-4" })}>
              Create your first course
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Learners</TableHead>
                  <TableHead>Avg progress</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>At risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/instructor/courses/${c.id}`} className="font-semibold hover:underline">
                        {c.title}
                      </Link>
                      {user.role === "admin" && <p className="text-xs text-muted-foreground">by {c.instructorName}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" aria-hidden /> {c.enrolled}
                      </span>
                    </TableCell>
                    <TableCell className="w-44">
                      <ProgressBar value={c.avgProgress} label={`${c.title} average progress`} showValue />
                    </TableCell>
                    <TableCell>{c.completed}</TableCell>
                    <TableCell>
                      {c.atRisk > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                          {c.atRisk} at risk
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/instructor/courses/${c.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          Progress
                        </Link>
                        <Link href={`/instructor/courses/${c.id}/edit`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                          <PenLine data-icon="inline-start" /> Edit
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
