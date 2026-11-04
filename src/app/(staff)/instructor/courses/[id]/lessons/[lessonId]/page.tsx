import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { LessonForm } from "@/components/instructor/lesson-form";
import { requireRole } from "@/lib/auth/session";
import { getManagedCourse } from "@/lib/queries/instructor";

type Props = { params: Promise<{ id: string; lessonId: string }> };

export const metadata: Metadata = { title: "Edit lesson" };

export default async function LessonEditorPage({ params }: Props) {
  const { id, lessonId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound();

  const user = await requireRole("instructor", "admin");
  const course = await getManagedCourse(user, id);
  if (!course) notFound();

  const [lesson] = await db.select().from(s.lessons).where(eq(s.lessons.id, lessonId)).limit(1);
  // The lesson must belong to THIS course — a valid id from another course is a 404.
  if (!lesson || lesson.courseId !== id) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href={`/instructor/courses/${id}/edit`} className="font-medium hover:underline">
            {course.title}
          </Link>{" "}
          / Lesson
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Edit lesson</h1>
      </header>
      <div className="rounded-2xl border bg-white p-6">
        <LessonForm
          lessonId={lessonId}
          values={{
            title: lesson.title,
            type: lesson.type,
            durationMin: lesson.durationMin,
            videoUrl: lesson.videoUrl,
            content: lesson.content,
          }}
        />
      </div>
    </main>
  );
}
