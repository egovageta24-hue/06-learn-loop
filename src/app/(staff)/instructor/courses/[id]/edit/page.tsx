import { ArrowDown, ArrowUp, FileText, ListChecks, CirclePlay, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  addLessonAction,
  addModuleAction,
  addQuizAction,
  deleteLessonAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
  renameModuleAction,
} from "@/actions/course-editor";
import { ActionButton } from "@/components/instructor/action-button";
import { CourseDetailsForm, PublishControls } from "@/components/instructor/course-forms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import { plural } from "@/lib/format";
import { getManagedCourse } from "@/lib/queries/instructor";
import { loadOutline } from "@/lib/queries/learning";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Course editor" };

export default async function CourseEditorPage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireRole("instructor", "admin");
  const course = await getManagedCourse(user, id);
  if (!course) notFound();
  const outline = await loadOutline({ id });
  if (!outline) notFound();

  const modules = [...outline.modules].sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/instructor" className="font-medium hover:underline">
              Instructor dashboard
            </Link>{" "}
            / Course editor
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{course.title}</h1>
          <Badge variant="secondary">{course.status}</Badge>
        </div>
        <Link href={`/instructor/courses/${id}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
          View learner progress
        </Link>
      </header>

      <section aria-labelledby="publish-heading" className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 id="publish-heading" className="text-lg font-bold">
          Visibility
        </h2>
        <p className="text-sm text-muted-foreground">
          {course.status === "published"
            ? "Learners can find and enroll in this course."
            : "Learners can't see this course yet. We'll check it's complete before it goes live."}
        </p>
        <PublishControls courseId={id} status={course.status} />
      </section>

      <section aria-labelledby="details-heading" className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 id="details-heading" className="text-lg font-bold">
          Course details
        </h2>
        <CourseDetailsForm
          courseId={id}
          values={{
            title: course.title,
            summary: course.summary,
            description: course.description,
            category: course.category,
            level: course.level,
            coverTheme: course.coverTheme,
          }}
        />
      </section>

      <section aria-labelledby="curriculum-heading" className="space-y-4">
        <h2 id="curriculum-heading" className="text-lg font-bold">
          Curriculum
        </h2>
        <p className="text-sm text-muted-foreground">
          Modules run in order. Learners finish a module&apos;s lessons, then pass its quiz to unlock the next one.
        </p>

        <ol className="space-y-5">
          {modules.map((m, mi) => {
            const lessons = [...m.lessons].sort((a, b) => a.position - b.position);
            return (
              <li key={m.id} className="overflow-hidden rounded-2xl border bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/40 px-4 py-3">
                  <span className="text-sm font-bold text-muted-foreground">Module {mi + 1}</span>
                  <form action={renameModuleAction.bind(null, m.id)} className="flex min-w-0 flex-1 items-center gap-2">
                    <label htmlFor={`module-${m.id}`} className="sr-only">
                      Module {mi + 1} title
                    </label>
                    <Input id={`module-${m.id}`} name="title" defaultValue={m.title} maxLength={100} required className="h-9 max-w-sm bg-white" />
                    <Button type="submit" size="sm" variant="outline">
                      Rename
                    </Button>
                  </form>
                  <div className="flex items-center">
                    <ActionButton action={moveModuleAction.bind(null, m.id, "up")} label="Move module up" disabled={mi === 0}>
                      <ArrowUp />
                    </ActionButton>
                    <ActionButton action={moveModuleAction.bind(null, m.id, "down")} label="Move module down" disabled={mi === modules.length - 1}>
                      <ArrowDown />
                    </ActionButton>
                    <ActionButton
                      action={deleteModuleAction.bind(null, m.id)}
                      label="Delete module"
                      confirm={`Delete “${m.title}” with its ${plural(lessons.length, "lesson")}${m.quiz ? " and quiz" : ""}? Learner progress on them is lost.`}
                    >
                      <Trash2 className="text-destructive" />
                    </ActionButton>
                  </div>
                </div>

                <ul className="divide-y">
                  {lessons.map((l, li) => (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                      {l.type === "video" ? (
                        <CirclePlay className="size-5 shrink-0 text-muted-foreground" aria-label="Video lesson" />
                      ) : (
                        <FileText className="size-5 shrink-0 text-muted-foreground" aria-label="Reading lesson" />
                      )}
                      <Link href={`/instructor/courses/${id}/lessons/${l.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                        {l.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{l.durationMin} min</span>
                      <div className="flex items-center">
                        <ActionButton action={moveLessonAction.bind(null, l.id, "up")} label="Move lesson up" disabled={li === 0}>
                          <ArrowUp />
                        </ActionButton>
                        <ActionButton action={moveLessonAction.bind(null, l.id, "down")} label="Move lesson down" disabled={li === lessons.length - 1}>
                          <ArrowDown />
                        </ActionButton>
                        <ActionButton action={deleteLessonAction.bind(null, l.id)} label="Delete lesson" confirm={`Delete “${l.title}”?`}>
                          <Trash2 className="text-destructive" />
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                  {lessons.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No lessons yet.</li>}

                  <li className="bg-violet-50/60 px-4 py-2.5">
                    {m.quiz ? (
                      <Link href={`/instructor/courses/${id}/quizzes/${m.quiz.id}`} className="flex items-center gap-3 text-sm font-medium hover:underline">
                        <ListChecks className="size-5 text-primary" aria-hidden />
                        <span className="flex-1">{m.quiz.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {plural(m.quiz.questionCount, "question")} · pass at {m.quiz.passScore}%
                        </span>
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">No quiz for this module.</p>
                    )}
                  </li>
                </ul>

                <div className="flex flex-wrap gap-2 border-t px-4 py-3">
                  <form action={addLessonAction.bind(null, m.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      <Plus data-icon="inline-start" /> Add lesson
                    </Button>
                  </form>
                  {!m.quiz && (
                    <form action={addQuizAction.bind(null, m.id)}>
                      <Button type="submit" size="sm" variant="outline">
                        <ListChecks data-icon="inline-start" /> Add quiz
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <form action={addModuleAction.bind(null, id)}>
          <Button type="submit" size="lg" variant="secondary">
            <Plus data-icon="inline-start" /> Add module
          </Button>
        </form>
      </section>
    </main>
  );
}
