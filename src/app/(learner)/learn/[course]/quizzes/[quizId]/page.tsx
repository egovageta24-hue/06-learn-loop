import { and, desc, eq } from "drizzle-orm";
import { CircleCheck, ListChecks, Play, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { startAttemptAction } from "@/actions/learning";
import { db } from "@/db";
import * as s from "@/db/schema";
import { QuizRunner } from "@/components/learning/quiz-runner";
import { Button, buttonVariants } from "@/components/ui/button";
import { canStartAttempt } from "@/lib/learning/remediation";
import { getLearningContext } from "@/lib/queries/context";
import { getRunnerData } from "@/lib/queries/quiz";

type Props = { params: Promise<{ course: string; quizId: string }> };

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({ params }: Props) {
  const { course, quizId } = await params;
  if (!z.uuid().safeParse(quizId).success) notFound();

  const { outline, enrollment, state, progress, next } = await getLearningContext(course);
  const mod = outline.modules.find((m) => m.quiz?.id === quizId);
  const quiz = mod?.quiz;
  if (!mod || !quiz) notFound();

  const modProgress = progress.modules.find((p) => p.moduleId === mod.id);
  // Locked module or unfinished lessons: the quiz isn't available yet.
  if (modProgress?.status === "locked" || modProgress?.lessonsDone !== modProgress?.lessonsTotal) redirect(next.href);

  const attempts = await db
    .select({ id: s.attempts.id, attemptNo: s.attempts.attemptNo, status: s.attempts.status, score: s.attempts.score, passed: s.attempts.passed })
    .from(s.attempts)
    .where(and(eq(s.attempts.enrollmentId, enrollment.id), eq(s.attempts.quizId, quizId)))
    .orderBy(desc(s.attempts.attemptNo));

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href={`/courses/${outline.slug}`} className="font-medium hover:underline">
            {outline.title}
          </Link>{" "}
          / {mod.title}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">{quiz.title}</h1>
      </header>
      {children}
    </main>
  );

  // 1. Already passed → celebrate, show the result, move on.
  if (state.passedQuizIds.includes(quizId)) {
    const best = attempts.find((a) => a.passed);
    return shell(
      <div className="space-y-4 rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-3">
          <CircleCheck className="size-8 text-orange-500" aria-hidden />
          <div>
            <p className="text-lg font-bold">You passed this quiz{best?.score != null ? ` with ${best.score}%` : ""}.</p>
            <p className="text-sm text-muted-foreground">Nothing more to do here.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={next.href} className={buttonVariants({ size: "xl" })}>
            {next.label}
          </Link>
          {best && (
            <Link href={`/learn/${outline.slug}/quizzes/${quizId}/attempts/${best.id}`} className={buttonVariants({ size: "xl", variant: "outline" })}>
              Review my answers
            </Link>
          )}
        </div>
      </div>,
    );
  }

  // 2. An attempt is in progress → resume it exactly where the learner left off.
  const open = attempts.find((a) => a.status === "in_progress");
  if (open) {
    const { questions, saved } = await getRunnerData(quizId, open.id);
    return shell(
      <>
        <p className="text-muted-foreground">
          Attempt {open.attemptNo} · {questions.length} questions · pass at {quiz.passScore}%. Your answers are saved as you go,
          so you can leave and come back.
        </p>
        <QuizRunner attemptId={open.id} questions={questions} saved={saved} />
      </>,
    );
  }

  // 3. Retake is blocked while required review items remain.
  const remediation = state.openRemediation[quizId] ?? null;
  if (!canStartAttempt(remediation) && remediation) {
    const remaining = remediation.items.filter((i) => !i.completed).length;
    return shell(
      <div className="space-y-4 rounded-2xl border border-orange-300 bg-orange-50 p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-6 shrink-0 text-orange-600" aria-hidden />
          <div>
            <p className="text-lg font-bold text-orange-950">Review {remaining} {remaining === 1 ? "lesson" : "lessons"} first</p>
            <p className="text-sm text-orange-900/80">
              A short review of the lessons behind the questions you missed makes the retake count.
            </p>
          </div>
        </div>
        <Link href={next.href} className={buttonVariants({ size: "xl" })}>
          {next.label}
        </Link>
      </div>,
    );
  }

  // 4. Ready to start (first attempt, or retake).
  const failed = attempts.filter((a) => a.passed === false).length;
  return shell(
    <div className="space-y-5 rounded-2xl border bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
          <ListChecks className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-bold">{attempts.length === 0 ? "Check what you've learned" : `Attempt ${attempts.length + 1}`}</p>
          <p className="text-sm text-muted-foreground">
            {quiz.questionCount} questions · pass at {quiz.passScore}% · no time limit
          </p>
        </div>
      </div>
      {failed > 0 && (
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          {remediation?.status === "escalated"
            ? "You've had several tries — your instructor has been notified and can help. You can retry whenever you like."
            : "You've reviewed the lessons — you're ready for another go."}
        </p>
      )}
      <form action={startAttemptAction.bind(null, quizId)}>
        <Button type="submit" size="xl">
          <Play data-icon="inline-start" />
          {attempts.length === 0 ? "Start quiz" : "Retake quiz"}
        </Button>
      </form>
    </div>,
  );
}
