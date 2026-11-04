import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { LessonActions } from "@/components/learning/lesson-actions";
import { Markdown } from "@/components/learning/markdown";
import { NotesPanel } from "@/components/learning/notes-panel";
import { Syllabus } from "@/components/learning/syllabus";
import { ProgressBar } from "@/components/brand/progress";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getLearningContext } from "@/lib/queries/context";

type Props = { params: Promise<{ course: string; lessonId: string }> };

export const metadata: Metadata = { title: "Lesson" };

/** Embeds YouTube links; anything else is treated as a direct video file. */
function VideoEmbed({ url, title }: { url: string; title: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt[1]}`}
          title={title}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }
  return (
    <video controls src={url} className="aspect-video w-full rounded-2xl border bg-black">
      <track kind="captions" />
    </video>
  );
}

export default async function LessonPage({ params }: Props) {
  const { course, lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) notFound();

  const { user, outline, state, progress, next } = await getLearningContext(course);

  const mod = outline.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  if (!mod) notFound();
  // A locked module can't be entered — send the learner where they should be.
  if (progress.modules.find((p) => p.moduleId === mod.id)?.status === "locked") redirect(next.href);

  const [lesson] = await db
    .select({ id: s.lessons.id, title: s.lessons.title, type: s.lessons.type, content: s.lessons.content, videoUrl: s.lessons.videoUrl, durationMin: s.lessons.durationMin })
    .from(s.lessons)
    .where(eq(s.lessons.id, lessonId))
    .limit(1);
  if (!lesson) notFound();

  const notes = await db
    .select({ id: s.notes.id, kind: s.notes.kind, body: s.notes.body, createdAt: s.notes.createdAt })
    .from(s.notes)
    .where(and(eq(s.notes.userId, user.id), eq(s.notes.lessonId, lessonId)))
    .orderBy(desc(s.notes.createdAt));

  const completed = state.completedLessonIds.includes(lessonId);
  const reviewFor = Object.values(state.openRemediation).find((r) => r.items.some((i) => i.lessonId === lessonId && !i.completed));
  const remaining = reviewFor?.items.filter((i) => !i.completed).length ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href={`/courses/${outline.slug}`} className="font-medium hover:text-foreground hover:underline">
          {outline.title}
        </Link>
        <span aria-hidden> / </span>
        <span>{mod.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <article className="min-w-0 space-y-6">
          <header className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{lesson.type === "video" ? "Video lesson" : "Reading"}</Badge>
              <span className="text-sm text-muted-foreground">{lesson.durationMin} min</span>
              {completed && <Badge className="bg-orange-500 text-white">Completed</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance">{lesson.title}</h1>
          </header>

          {reviewFor && (
            <div role="status" className="flex gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-orange-600" aria-hidden />
              <div>
                <p className="font-semibold text-orange-950">Review lesson</p>
                <p className="text-sm text-orange-900/80">
                  This covers questions you missed. Mark it reviewed
                  {remaining > 1 ? ` — ${remaining - 1} more to go after this one` : " to unlock your retake"}.
                </p>
              </div>
            </div>
          )}

          {lesson.type === "video" && lesson.videoUrl && <VideoEmbed url={lesson.videoUrl} title={lesson.title} />}

          <div className="rounded-2xl border bg-white p-6 sm:p-8">
            <Markdown>{lesson.content || "_This lesson has no written content yet._"}</Markdown>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-5">
            {completed && !reviewFor ? (
              <>
                <div className="flex-1">
                  <p className="font-semibold">You&apos;ve completed this lesson.</p>
                  <p className="text-sm text-muted-foreground">Your next step is ready.</p>
                </div>
                <Link href={next.href} className={buttonVariants({ size: "xl" })}>
                  {next.label} <ArrowRight data-icon="inline-end" />
                </Link>
              </>
            ) : (
              <LessonActions lessonId={lessonId} isReviewItem={Boolean(reviewFor)} />
            )}
          </div>

          <NotesPanel
            lessonId={lessonId}
            bookmarked={notes.some((n) => n.kind === "bookmark")}
            notes={notes
              .filter((n) => n.kind === "note" && n.body)
              .map((n) => ({ id: n.id, body: n.body!, createdAt: n.createdAt.toISOString() }))}
          />
        </article>

        <aside aria-label="Course outline" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-white p-4">
            <p className="mb-2 text-sm font-semibold">Course progress</p>
            <ProgressBar value={progress.percent} label="Course progress" showValue />
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.doneUnits} of {progress.totalUnits} steps complete
            </p>
          </div>
          <Syllabus outline={outline} progress={progress} state={state} currentLessonId={lessonId} />
        </aside>
      </div>
    </main>
  );
}
