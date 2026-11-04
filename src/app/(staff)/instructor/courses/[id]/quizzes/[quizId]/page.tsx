import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { deleteQuizAction } from "@/actions/course-editor";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { NewQuestion, QuestionEditor, QuizSettingsForm, type QuestionData } from "@/components/instructor/quiz-editor";
import { requireRole } from "@/lib/auth/session";
import { getManagedCourse } from "@/lib/queries/instructor";

type Props = { params: Promise<{ id: string; quizId: string }> };

export const metadata: Metadata = { title: "Edit quiz" };

export default async function QuizEditorPage({ params }: Props) {
  const { id, quizId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(quizId).success) notFound();

  const user = await requireRole("instructor", "admin");
  const course = await getManagedCourse(user, id);
  if (!course) notFound();

  const [quiz] = await db.select().from(s.quizzes).where(eq(s.quizzes.id, quizId)).limit(1);
  if (!quiz || quiz.courseId !== id) notFound();

  const [lessons, questions] = await Promise.all([
    db
      .select({ id: s.lessons.id, title: s.lessons.title })
      .from(s.lessons)
      .where(eq(s.lessons.moduleId, quiz.moduleId))
      .orderBy(asc(s.lessons.position)),
    db.select().from(s.questions).where(eq(s.questions.quizId, quizId)).orderBy(asc(s.questions.position)),
  ]);
  const options = questions.length
    ? await db
        .select()
        .from(s.options)
        .where(inArray(s.options.questionId, questions.map((q) => q.id)))
        .orderBy(asc(s.options.position))
    : [];

  const data: QuestionData[] = questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    explanation: q.explanation ?? "",
    lessonId: q.lessonId,
    options: options.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href={`/instructor/courses/${id}/edit`} className="font-medium hover:underline">
            {course.title}
          </Link>{" "}
          / Quiz
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">{quiz.title}</h1>
      </header>

      <section aria-labelledby="settings-heading" className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 id="settings-heading" className="text-lg font-bold">
          Settings
        </h2>
        <QuizSettingsForm quizId={quizId} values={{ title: quiz.title, passScore: quiz.passScore, escalateAfter: quiz.escalateAfter }} />
      </section>

      <section aria-labelledby="questions-heading" className="space-y-4">
        <div>
          <h2 id="questions-heading" className="text-lg font-bold">
            Questions ({data.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Link each question to the lesson that teaches it — when a learner misses it, that&apos;s the lesson they&apos;re sent back to.
          </p>
        </div>

        {data.map((q, i) => (
          // Re-key on option ids so the editor remounts with fresh ids after a save.
          <QuestionEditor
            key={`${q.id}-${q.options.map((o) => o.id).join()}`}
            quizId={quizId}
            question={q}
            lessons={lessons}
            index={i}
            count={data.length}
          />
        ))}

        <NewQuestion quizId={quizId} lessons={lessons} />
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-bold text-destructive">Delete this quiz</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes the quiz, its questions and every learner attempt. The module will no longer have a quiz gate.
        </p>
        <form action={deleteQuizAction.bind(null, quizId)} className="mt-3">
          <ConfirmSubmit message="Delete this quiz and all attempts on it?" variant="destructive">
            Delete quiz
          </ConfirmSubmit>
        </form>
      </section>
    </main>
  );
}
