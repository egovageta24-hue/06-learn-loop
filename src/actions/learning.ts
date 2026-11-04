"use server";

import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getNextAction } from "@/lib/learning/next-action";
import { computeProgress } from "@/lib/learning/progress";
import { canStartAttempt, statusAfterItemReviewed } from "@/lib/learning/remediation";
import { scoreAndRecordAttempt } from "@/lib/learning/submit-attempt";
import { loadEnrollmentState, loadOutline, OPEN_REMEDIATION } from "@/lib/queries/learning";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const id = z.uuid();

/** Lesson + course + the *current user's* enrollment, or null if any link is missing. */
async function getLessonContext(userId: string, lessonId: string) {
  const [row] = await db
    .select({
      lessonId: s.lessons.id,
      moduleId: s.lessons.moduleId,
      courseId: s.lessons.courseId,
      slug: s.courses.slug,
      enrollmentId: s.enrollments.id,
    })
    .from(s.lessons)
    .innerJoin(s.courses, eq(s.courses.id, s.lessons.courseId))
    .innerJoin(s.enrollments, and(eq(s.enrollments.courseId, s.courses.id), eq(s.enrollments.userId, userId)))
    .where(eq(s.lessons.id, lessonId))
    .limit(1);
  return row ?? null;
}

/** Attempt + quiz + course for an attempt owned by `userId`, or null. */
async function getAttemptContext(userId: string, attemptId: string) {
  const [row] = await db
    .select({
      attemptId: s.attempts.id,
      status: s.attempts.status,
      enrollmentId: s.attempts.enrollmentId,
      quizId: s.attempts.quizId,
      moduleId: s.quizzes.moduleId,
      courseId: s.quizzes.courseId,
      slug: s.courses.slug,
    })
    .from(s.attempts)
    .innerJoin(s.enrollments, eq(s.enrollments.id, s.attempts.enrollmentId))
    .innerJoin(s.quizzes, eq(s.quizzes.id, s.attempts.quizId))
    .innerJoin(s.courses, eq(s.courses.id, s.quizzes.courseId))
    .where(and(eq(s.attempts.id, attemptId), eq(s.enrollments.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Recomputes completion from the persisted facts; returns the fresh outline + state. */
async function syncEnrollmentCompletion(enrollmentId: string, courseId: string) {
  const [outline, state] = await Promise.all([loadOutline({ id: courseId }), loadEnrollmentState(enrollmentId)]);
  if (!outline) return null;
  const complete = computeProgress(outline, state).isComplete;
  await db
    .update(s.enrollments)
    .set(
      complete
        ? { status: "completed", completedAt: sql`coalesce(${s.enrollments.completedAt}, now())` }
        : { status: "active", completedAt: null },
    )
    .where(eq(s.enrollments.id, enrollmentId));
  return { outline, state };
}

export async function enrollAction(courseId: string) {
  const user = await requireUser();
  const parsed = id.safeParse(courseId);
  if (!parsed.success) redirect("/courses");

  const [course] = await db
    .select({ id: s.courses.id, slug: s.courses.slug, status: s.courses.status, orgId: s.courses.orgId })
    .from(s.courses)
    .where(eq(s.courses.id, parsed.data))
    .limit(1);
  if (!course || course.status !== "published" || course.orgId !== user.orgId) redirect("/courses");

  await db.insert(s.enrollments).values({ userId: user.id, courseId: course.id }).onConflictDoNothing();
  revalidatePath("/dashboard");
  redirect(`/learn/${course.slug}`);
}

/** Called when a lesson page mounts: creates progress row and moves the resume pointer. */
export async function recordLessonOpened(lessonId: string): Promise<Result> {
  const user = await requireUser();
  if (!id.safeParse(lessonId).success) return { ok: false, error: "Invalid lesson." };
  const ctx = await getLessonContext(user.id, lessonId);
  if (!ctx) return { ok: false, error: "You are not enrolled in this course." };

  await db
    .insert(s.lessonProgress)
    .values({ enrollmentId: ctx.enrollmentId, lessonId, status: "in_progress" })
    .onConflictDoNothing();
  await db
    .update(s.enrollments)
    .set({ lastLessonId: lessonId, lastActivityAt: new Date() })
    .where(eq(s.enrollments.id, ctx.enrollmentId));
  return { ok: true };
}

/**
 * Marks a lesson complete (idempotent) and, if this lesson is an unreviewed
 * remediation item, ticks it off — flipping the record to `ready` when the
 * last item is done. Returns where the learner should go next.
 */
export async function completeLessonAction(lessonId: string): Promise<Result<{ nextHref: string; nextLabel: string }>> {
  const user = await requireUser();
  if (!id.safeParse(lessonId).success) return { ok: false, error: "Invalid lesson." };
  const ctx = await getLessonContext(user.id, lessonId);
  if (!ctx) return { ok: false, error: "You are not enrolled in this course." };

  await db.transaction(async (tx) => {
    await tx
      .insert(s.lessonProgress)
      .values({ enrollmentId: ctx.enrollmentId, lessonId, status: "completed", completedAt: new Date() })
      .onConflictDoUpdate({
        target: [s.lessonProgress.enrollmentId, s.lessonProgress.lessonId],
        set: {
          status: "completed",
          completedAt: sql`coalesce(${s.lessonProgress.completedAt}, now())`,
          updatedAt: new Date(),
        },
      });

    await tx
      .update(s.enrollments)
      .set({ lastLessonId: lessonId, lastActivityAt: new Date() })
      .where(eq(s.enrollments.id, ctx.enrollmentId));

    // Tick off this lesson in any open, unreviewed remediation for the enrollment.
    const pending = await tx
      .select({ itemId: s.remediationItems.id, recordId: s.remediationRecords.id })
      .from(s.remediationItems)
      .innerJoin(s.remediationRecords, eq(s.remediationRecords.id, s.remediationItems.remediationId))
      .where(
        and(
          eq(s.remediationRecords.enrollmentId, ctx.enrollmentId),
          inArray(s.remediationRecords.status, [...OPEN_REMEDIATION]),
          eq(s.remediationItems.lessonId, lessonId),
          isNull(s.remediationItems.completedAt),
        ),
      );

    if (pending.length > 0) {
      await tx
        .update(s.remediationItems)
        .set({ completedAt: new Date() })
        .where(inArray(s.remediationItems.id, pending.map((p) => p.itemId)));

      for (const recordId of new Set(pending.map((p) => p.recordId))) {
        const [record] = await tx
          .select({ status: s.remediationRecords.status })
          .from(s.remediationRecords)
          .where(eq(s.remediationRecords.id, recordId));
        const items = await tx
          .select({ completedAt: s.remediationItems.completedAt })
          .from(s.remediationItems)
          .where(eq(s.remediationItems.remediationId, recordId));
        const next = statusAfterItemReviewed(
          record.status as "required" | "ready" | "escalated",
          items.map((i) => ({ completed: i.completedAt !== null })),
        );
        if (next !== record.status) {
          await tx.update(s.remediationRecords).set({ status: next }).where(eq(s.remediationRecords.id, recordId));
        }
      }
    }
  });

  const synced = await syncEnrollmentCompletion(ctx.enrollmentId, ctx.courseId);
  revalidatePath("/dashboard");
  if (!synced) return { ok: true, nextHref: "/dashboard", nextLabel: "Back to dashboard" };
  const next = getNextAction(synced.outline, synced.state);
  return { ok: true, nextHref: next.href, nextLabel: next.label };
}

/** Starts (or resumes) an attempt, then lands on the quiz page, which renders whichever state applies. */
export async function startAttemptAction(quizId: string) {
  const user = await requireUser();
  if (!id.safeParse(quizId).success) notFound();

  const [quiz] = await db
    .select({
      id: s.quizzes.id,
      moduleId: s.quizzes.moduleId,
      courseId: s.quizzes.courseId,
      slug: s.courses.slug,
    })
    .from(s.quizzes)
    .innerJoin(s.courses, eq(s.courses.id, s.quizzes.courseId))
    .where(eq(s.quizzes.id, quizId))
    .limit(1);
  if (!quiz) notFound();

  const quizUrl = `/learn/${quiz.slug}/quizzes/${quiz.id}`;
  const [enrollment] = await db
    .select({ id: s.enrollments.id })
    .from(s.enrollments)
    .where(and(eq(s.enrollments.userId, user.id), eq(s.enrollments.courseId, quiz.courseId)))
    .limit(1);
  if (!enrollment) redirect(`/courses/${quiz.slug}`);

  const [outline, state] = await Promise.all([loadOutline({ id: quiz.courseId }), loadEnrollmentState(enrollment.id)]);
  const mod = outline?.modules.find((m) => m.id === quiz.moduleId);
  if (!outline || !mod) notFound();

  const lessonsDone = mod.lessons.every((l) => state.completedLessonIds.includes(l.id));
  const alreadyPassed = state.passedQuizIds.includes(quizId);
  const hasOpenAttempt = Boolean(state.inProgressAttempts[quizId]);
  const gate = canStartAttempt(state.openRemediation[quizId] ?? null);

  if (!hasOpenAttempt && lessonsDone && !alreadyPassed && gate && (mod.quiz?.questionCount ?? 0) > 0) {
    try {
      await db.transaction(async (tx) => {
        const [last] = await tx
          .select({ n: s.attempts.attemptNo })
          .from(s.attempts)
          .where(and(eq(s.attempts.enrollmentId, enrollment.id), eq(s.attempts.quizId, quizId)))
          .orderBy(desc(s.attempts.attemptNo))
          .limit(1);
        await tx.insert(s.attempts).values({ enrollmentId: enrollment.id, quizId, attemptNo: (last?.n ?? 0) + 1 });
        await tx
          .update(s.enrollments)
          .set({ lastActivityAt: new Date() })
          .where(eq(s.enrollments.id, enrollment.id));
      });
    } catch {
      // A concurrent start won the unique index; the open attempt it created is the one we want.
    }
  }

  revalidatePath(quizUrl);
  redirect(quizUrl);
}

const saveAnswerInput = z.object({
  attemptId: id,
  questionId: id,
  optionIds: z.array(id).max(10),
});

/** Autosave for one question. Validates ownership, state and that options belong to the question. */
export async function saveAnswerAction(input: z.input<typeof saveAnswerInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = saveAnswerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid answer." };
  const { attemptId, questionId, optionIds } = parsed.data;

  const ctx = await getAttemptContext(user.id, attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };
  if (ctx.status !== "in_progress") return { ok: false, error: "This attempt has already been submitted." };

  const [question] = await db
    .select({ id: s.questions.id, type: s.questions.type })
    .from(s.questions)
    .where(and(eq(s.questions.id, questionId), eq(s.questions.quizId, ctx.quizId)))
    .limit(1);
  if (!question) return { ok: false, error: "Question not found." };

  const unique = [...new Set(optionIds)];
  if (question.type !== "multiple" && unique.length > 1) return { ok: false, error: "Choose one answer." };
  if (unique.length > 0) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(s.options)
      .where(and(eq(s.options.questionId, questionId), inArray(s.options.id, unique)));
    if (n !== unique.length) return { ok: false, error: "Invalid option." };
  }

  await db
    .insert(s.answers)
    .values({ attemptId, questionId, selectedOptionIds: unique })
    .onConflictDoUpdate({
      target: [s.answers.attemptId, s.answers.questionId],
      set: { selectedOptionIds: unique, answeredAt: new Date() },
    });
  return { ok: true };
}

/**
 * Scores an attempt exactly once. The UPDATE … WHERE status='in_progress'
 * claims the attempt; a concurrent/duplicate submit finds nothing to claim and
 * simply lands on the existing results page.
 */
export async function submitAttemptAction(attemptId: string) {
  const user = await requireUser();
  if (!id.safeParse(attemptId).success) notFound();
  const ctx = await getAttemptContext(user.id, attemptId);
  if (!ctx) notFound();

  const resultsUrl = `/learn/${ctx.slug}/quizzes/${ctx.quizId}/attempts/${attemptId}`;

  await scoreAndRecordAttempt({
    attemptId,
    enrollmentId: ctx.enrollmentId,
    quizId: ctx.quizId,
    moduleId: ctx.moduleId,
  });

  await syncEnrollmentCompletion(ctx.enrollmentId, ctx.courseId);
  revalidatePath("/dashboard");
  redirect(resultsUrl);
}

// ---------------------------------------------------------------------------
// Notes & bookmarks
// ---------------------------------------------------------------------------

const noteInput = z.object({ lessonId: id, body: z.string().trim().min(1, "Write something first.").max(2000) });

export async function addNoteAction(input: z.input<typeof noteInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note." };
  const ctx = await getLessonContext(user.id, parsed.data.lessonId);
  if (!ctx) return { ok: false, error: "You are not enrolled in this course." };

  await db.insert(s.notes).values({ userId: user.id, lessonId: ctx.lessonId, kind: "note", body: parsed.data.body });
  revalidatePath(`/learn/${ctx.slug}/lessons/${ctx.lessonId}`);
  revalidatePath("/progress");
  return { ok: true };
}

export async function deleteNoteAction(noteId: string): Promise<Result> {
  const user = await requireUser();
  if (!id.safeParse(noteId).success) return { ok: false, error: "Invalid note." };
  const [deleted] = await db
    .delete(s.notes)
    .where(and(eq(s.notes.id, noteId), eq(s.notes.userId, user.id)))
    .returning({ lessonId: s.notes.lessonId });
  if (!deleted) return { ok: false, error: "Note not found." };
  const ctx = await getLessonContext(user.id, deleted.lessonId);
  if (ctx) revalidatePath(`/learn/${ctx.slug}/lessons/${ctx.lessonId}`);
  revalidatePath("/progress");
  return { ok: true };
}

export async function toggleBookmarkAction(lessonId: string): Promise<Result<{ bookmarked: boolean }>> {
  const user = await requireUser();
  if (!id.safeParse(lessonId).success) return { ok: false, error: "Invalid lesson." };
  const ctx = await getLessonContext(user.id, lessonId);
  if (!ctx) return { ok: false, error: "You are not enrolled in this course." };

  const existing = and(eq(s.notes.userId, user.id), eq(s.notes.lessonId, lessonId), eq(s.notes.kind, "bookmark"));
  const removed = await db.delete(s.notes).where(existing).returning({ id: s.notes.id });
  if (removed.length === 0) {
    await db.insert(s.notes).values({ userId: user.id, lessonId, kind: "bookmark" });
  }
  revalidatePath(`/learn/${ctx.slug}/lessons/${lessonId}`);
  revalidatePath("/progress");
  return { ok: true, bookmarked: removed.length === 0 };
}
