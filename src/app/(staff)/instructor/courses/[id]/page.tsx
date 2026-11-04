import { formatDistanceToNow } from "date-fns";
import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LessonFunnelChart } from "@/components/charts/lesson-funnel-chart";
import { ProgressBar } from "@/components/brand/progress";
import { StatusBadge } from "@/components/instructor/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { getCourseInsights, getCourseRoster, getManagedCourse } from "@/lib/queries/instructor";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Learner progress" };

export default async function CourseProgressPage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireRole("instructor", "admin");

  const course = await getManagedCourse(user, id);
  if (!course) notFound();
  const roster = await getCourseRoster(id);
  if (!roster) notFound();

  const { outline, rows } = roster;
  const insights = await getCourseInsights(outline);

  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length) : 0;
  const completed = rows.filter((r) => r.status === "completed").length;
  const quizzes = outline.modules.flatMap((m) => (m.quiz ? [m.quiz] : []));
  const attempted = insights.quizzes.reduce((n, q) => n + q.attempts, 0);
  const passRate =
    attempted > 0
      ? Math.round(
          (insights.quizzes.reduce((n, q) => n + (q.passRate ?? 0) * q.attempts, 0) / attempted),
        )
      : null;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/instructor" className="font-medium hover:underline">
              Instructor dashboard
            </Link>{" "}
            / Learner progress
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{course.title}</h1>
          <Badge variant="secondary">{course.status}</Badge>
        </div>
        <Link href={`/instructor/courses/${id}/edit`} className={buttonVariants({ size: "lg", variant: "secondary" })}>
          <PenLine data-icon="inline-start" /> Edit course
        </Link>
      </header>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Learners enrolled", value: rows.length },
          { label: "Average progress", value: `${avg}%` },
          { label: "Completed the course", value: completed },
          { label: "Quiz pass rate", value: passRate === null ? "—" : `${passRate}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{k.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="learners-heading" className="space-y-3">
        <h2 id="learners-heading" className="text-xl font-bold">
          Learners
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-muted-foreground">
            No one has enrolled yet. Publish the course and share it from the catalog.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  {quizzes.map((q) => (
                    <TableHead key={q.id} className="whitespace-nowrap">
                      {q.title.replace(/ quiz$/i, "")} score
                    </TableHead>
                  ))}
                  <TableHead>Last active</TableHead>
                  <TableHead>Next step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="w-44">
                      <ProgressBar value={r.percent} label={`${r.name} progress`} showValue />
                    </TableCell>
                    {quizzes.map((q) => (
                      <TableCell key={q.id} className="tabular-nums">
                        {r.bestScores[q.id] !== undefined ? `${r.bestScores[q.id]}%` : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDistanceToNow(r.lastActivityAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{r.nextLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="funnel-heading" className="space-y-3 rounded-2xl border bg-white p-5 sm:p-6">
          <div>
            <h2 id="funnel-heading" className="text-xl font-bold">
              Where learners drop off
            </h2>
            <p className="text-sm text-muted-foreground">Learners who completed each lesson, in course order.</p>
          </div>
          {insights.funnel.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Add lessons to see completion by lesson.</p>
          ) : (
            <LessonFunnelChart
              enrolled={rows.length}
              data={insights.funnel.map((f) => ({ label: f.label, title: f.title, completed: f.completed }))}
            />
          )}
        </section>

        <section aria-labelledby="quiz-heading" className="space-y-5 rounded-2xl border bg-white p-5 sm:p-6">
          <div>
            <h2 id="quiz-heading" className="text-xl font-bold">
              Quiz insights
            </h2>
            <p className="text-sm text-muted-foreground">Pass rates, and the questions learners miss most.</p>
          </div>

          {insights.quizzes.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">This course has no quizzes yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {insights.quizzes.map((q) => (
                <li key={q.quizId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{q.title}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {q.attempts === 0
                      ? "No attempts yet"
                      : `${q.attempts} attempts · ${q.passRate}% pass · avg ${q.avgScore}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold">Hardest questions</h3>
            {insights.hardest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Appears once learners submit quizzes.</p>
            ) : (
              <ol className="space-y-3">
                {insights.hardest.map((h) => (
                  <li key={h.questionId}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{h.prompt}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{h.missRate}% missed</span>
                    </div>
                    <div
                      role="img"
                      aria-label={`${h.missRate}% of ${h.answered} answers were wrong`}
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${h.missRate}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.quizTitle} · {h.answered} answers
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
