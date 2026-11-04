import { format } from "date-fns";
import { Bookmark, CircleCheck, Lock, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScoreHistoryChart, type ScorePoint } from "@/components/charts/score-history-chart";
import { ProgressBar, ProgressRing } from "@/components/brand/progress";
import { NextActionLink } from "@/components/learning/next-action-link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getLearnerCourses, getNotes, getQuizHistory } from "@/lib/queries/learner";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const [courses, history, notes] = await Promise.all([
    getLearnerCourses(user.id),
    getQuizHistory(user.id),
    getNotes(user.id),
  ]);

  const points: ScorePoint[] = history.map((h, idx) => ({
    idx,
    dateLabel: format(h.submittedAt, "MMM d"),
    score: h.score,
    passed: h.passed,
    quizTitle: h.quizTitle,
    courseTitle: h.courseTitle,
    attemptNo: h.attemptNo,
  }));
  // Only draw a pass-mark line when every quiz shares one, otherwise it would be wrong for some.
  const passMarks = new Set(history.map((h) => h.passScore));
  const passMark = passMarks.size === 1 ? [...passMarks][0] : null;

  const bestByQuiz = new Map<string, number>();
  for (const h of history) bestByQuiz.set(h.quizId, Math.max(bestByQuiz.get(h.quizId) ?? 0, h.score));

  const totalDone = courses.reduce((n, c) => n + c.progress.doneUnits, 0);
  const totalUnits = courses.reduce((n, c) => n + c.progress.totalUnits, 0);
  const passedCount = history.filter((h) => h.passed).length;

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Your progress</h1>
        <p className="text-muted-foreground">Everything you&apos;ve done, saved to your account.</p>
      </header>

      {courses.length === 0 ? (
        <section className="rounded-3xl border border-dashed bg-white/70 p-12 text-center">
          <p className="text-lg font-semibold">Nothing to show yet.</p>
          <p className="mt-1 text-muted-foreground">Enroll in a course and your progress will build up here.</p>
          <Link href="/courses" className={buttonVariants({ size: "xl", className: "mt-5" })}>
            Browse courses
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Courses", value: courses.length },
              { label: "Steps completed", value: `${totalDone}/${totalUnits}` },
              { label: "Quizzes passed", value: passedCount },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-white p-5">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{s.value}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="courses-heading" className="space-y-4">
            <h2 id="courses-heading" className="text-xl font-bold">
              By course
            </h2>
            <ul className="space-y-5">
              {courses.map((c) => (
                <li key={c.enrollmentId} className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <ProgressRing value={c.progress.percent} label={`${c.outline.title} progress`} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold">
                        <Link href={`/courses/${c.outline.slug}`} className="hover:underline">
                          {c.outline.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {c.progress.doneUnits} of {c.progress.totalUnits} steps complete
                      </p>
                    </div>
                    <NextActionLink action={c.next} />
                  </div>

                  <ol className="grid gap-3 md:grid-cols-2">
                    {c.outline.modules.map((m, mi) => {
                      const mp = c.progress.modules.find((p) => p.moduleId === m.id)!;
                      const best = m.quiz ? bestByQuiz.get(m.quiz.id) : undefined;
                      return (
                        <li key={m.id} className="rounded-xl border bg-secondary/30 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">
                              {mi + 1}. {m.title}
                            </p>
                            {mp.status === "complete" && <CircleCheck className="size-5 shrink-0 text-orange-500" aria-label="Module complete" />}
                            {mp.status === "locked" && <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked" />}
                          </div>
                          <ProgressBar
                            className="mt-2"
                            value={mp.lessonsTotal === 0 ? 0 : (mp.lessonsDone / mp.lessonsTotal) * 100}
                            label={`${m.title} lessons`}
                          />
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {mp.lessonsDone}/{mp.lessonsTotal} lessons
                            {m.quiz &&
                              (mp.quizPassed
                                ? ` · quiz passed${best !== undefined ? ` (best ${best}%)` : ""}`
                                : best !== undefined
                                  ? ` · quiz not passed yet (best ${best}%)`
                                  : " · quiz not taken")}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="scores-heading" className="space-y-3 rounded-2xl border bg-white p-5 sm:p-6">
            <div>
              <h2 id="scores-heading" className="text-xl font-bold">
                Quiz scores over time
              </h2>
              <p className="text-sm text-muted-foreground">Every submitted attempt, oldest to newest.</p>
            </div>
            {points.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No quiz attempts yet — your scores will appear here.</p>
            ) : (
              <ScoreHistoryChart data={points} passMark={passMark} />
            )}
          </section>
        </>
      )}

      <section aria-labelledby="notes-heading" className="space-y-4">
        <h2 id="notes-heading" className="text-xl font-bold">
          Notes &amp; bookmarks
        </h2>
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-muted-foreground">
            Add notes or bookmark lessons while you learn and they&apos;ll collect here.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/learn/${n.courseSlug}/lessons/${n.lessonId}`}
                  className="flex h-full gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-primary"
                >
                  {n.kind === "bookmark" ? (
                    <Bookmark className="mt-0.5 size-5 shrink-0 text-orange-500" aria-label="Bookmark" />
                  ) : (
                    <NotebookPen className="mt-0.5 size-5 shrink-0 text-primary" aria-label="Note" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{n.lessonTitle}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body ?? "Bookmarked lesson"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.courseTitle} · {format(n.createdAt, "MMM d, yyyy")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
