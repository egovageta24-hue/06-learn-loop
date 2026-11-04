import { ArrowRight, CircleCheck, CircleX, LifeBuoy, Lock, RotateCcw, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ProgressRing } from "@/components/brand/progress";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getLearningContext } from "@/lib/queries/context";
import { getAttemptResult } from "@/lib/queries/quiz";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ course: string; quizId: string; attemptId: string }> };

export const metadata: Metadata = { title: "Quiz results" };

export default async function ResultsPage({ params }: Props) {
  const { course, quizId, attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) notFound();

  const { user, outline, next } = await getLearningContext(course);
  const result = await getAttemptResult(attemptId, user.id);
  if (!result || result.attempt.quizId !== quizId) {
    // Not submitted yet (or not yours): the quiz page knows what to show.
    redirect(`/learn/${outline.slug}/quizzes/${quizId}`);
  }

  const { attempt, questions, remediation, failedCount } = result;
  const passed = attempt.passed === true;
  const base = `/learn/${outline.slug}`;

  const open = remediation && ["required", "ready", "escalated"].includes(remediation.status) ? remediation : null;
  const remaining = open ? open.items.filter((i) => !i.completed) : [];
  const gated = open?.status === "required" && remaining.length > 0;
  const superseded = remediation?.status === "superseded";

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <section
        aria-labelledby="result-heading"
        className={cn("rounded-3xl border p-6 sm:p-8", passed ? "border-orange-300 bg-orange-50" : "bg-white")}
      >
        <div className="flex flex-wrap items-center gap-6">
          <ProgressRing value={attempt.score ?? 0} size={104} stroke={11} label="Quiz score" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {attempt.quizTitle} · attempt {attempt.attemptNo}
            </p>
            <h1 id="result-heading" className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              {passed ? (
                <>
                  <Trophy className="size-8 text-orange-500" aria-hidden /> You passed!
                </>
              ) : (
                "Not quite yet"
              )}
            </h1>
            <p className="text-muted-foreground">
              You answered {attempt.correctCount} of {attempt.totalCount} correctly ({attempt.score}%). The pass mark is{" "}
              {attempt.passScore}%.
            </p>
          </div>
        </div>

        {passed && (
          <div className="mt-6">
            <Link href={next.href} className={buttonVariants({ size: "xl" })}>
              {next.label} <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        )}
      </section>

      {!passed && superseded && (
        <section className="space-y-3 rounded-2xl border bg-white p-6">
          <p className="font-semibold">This was an earlier attempt.</p>
          <p className="text-sm text-muted-foreground">You&apos;ve taken this quiz again since — here&apos;s your current next step.</p>
          <Link href={next.href} className={buttonVariants({ size: "lg" })}>
            {next.label} <ArrowRight data-icon="inline-end" />
          </Link>
        </section>
      )}

      {!passed && open && (
        <section aria-labelledby="remediation-heading" className="space-y-4 rounded-2xl border bg-white p-6">
          <div className="space-y-1">
            <h2 id="remediation-heading" className="text-xl font-bold">
              {open.status === "escalated" ? "Let's get you unstuck" : gated ? "Review these lessons, then retake" : "You're ready to retake"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {open.status === "escalated"
                ? `That's ${failedCount} attempts — your instructor has been notified and can help. Reviewing is optional now; retry whenever you're ready.`
                : gated
                  ? "These lessons cover the questions you missed. Finish them and your retake unlocks."
                  : "You've reviewed everything. Take another go when you're ready."}
            </p>
          </div>

          {open.status === "escalated" && (
            <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
              <LifeBuoy className="size-4 shrink-0 text-primary" aria-hidden /> Your instructor can see your progress on this quiz.
            </p>
          )}

          {open.items.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {open.items.map((item) => (
                <li key={item.lessonId} className="flex items-center gap-3 px-4 py-3">
                  {item.completed ? (
                    <CircleCheck className="size-5 shrink-0 text-orange-500" aria-label="Reviewed" />
                  ) : (
                    <span className="size-5 shrink-0 rounded-full border-2 border-slate-300" aria-label="Not reviewed yet" />
                  )}
                  <span className="flex-1 font-medium">{item.lessonTitle}</span>
                  <Link
                    href={`${base}/lessons/${item.lessonId}`}
                    className={buttonVariants({ size: "sm", variant: item.completed ? "ghost" : "default" })}
                  >
                    {item.completed ? "Open again" : "Review"}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {gated ? (
              <>
                <Link href={`${base}/lessons/${remaining[0].lessonId}`} className={buttonVariants({ size: "xl" })}>
                  Review: {remaining[0].lessonTitle} <ArrowRight data-icon="inline-end" />
                </Link>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lock className="size-4" aria-hidden /> Retake unlocks after review
                </span>
              </>
            ) : (
              <Link href={`${base}/quizzes/${quizId}`} className={buttonVariants({ size: "xl" })}>
                <RotateCcw data-icon="inline-start" /> Retake the quiz
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="review-heading" className="space-y-4">
        <h2 id="review-heading" className="text-xl font-bold">
          Question by question
        </h2>
        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start gap-3">
                {q.isCorrect ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Correct" />
                ) : (
                  <CircleX className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Incorrect" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-semibold">
                    {i + 1}. {q.prompt}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Your answer: </span>
                    {q.selected.length ? q.selected.join(", ") : <em className="text-muted-foreground">No answer</em>}
                  </p>
                  {!q.isCorrect && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-medium">{q.correct.join(", ")}</span>
                    </p>
                  )}
                  {q.explanation && <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">{q.explanation}</p>}
                  {!q.isCorrect && q.lessonId && (
                    <Link href={`${base}/lessons/${q.lessonId}`} className="inline-block text-sm font-semibold text-primary hover:underline">
                      Review: {q.lessonTitle}
                    </Link>
                  )}
                </div>
                <Badge variant={q.isCorrect ? "secondary" : "destructive"}>{q.isCorrect ? "Correct" : "Missed"}</Badge>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
