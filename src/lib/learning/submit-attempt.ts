import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import * as s from "@/db/schema";
import { decideAfterSubmit } from "./remediation";
import { scoreAttempt } from "./scoring";
import { OPEN_REMEDIATION } from "./types";

/** Identifies an attempt that the CALLER has already authorised for the current user. */
export interface AttemptRef {
  attemptId: string;
  enrollmentId: string;
  quizId: string;
  moduleId: string;
}

export interface SubmitOutcome {
  /** False when the attempt had already been submitted (a duplicate/concurrent call). */
  scored: boolean;
  score?: number;
  passed?: boolean;
}

/**
 * Scores an in-progress attempt exactly once and records the consequences
 * (answers, score, remediation) in a single transaction.
 *
 * Concurrency: the first statement claims the attempt with
 * `UPDATE … WHERE status = 'in_progress'`. A second caller blocks on that row
 * lock, then sees status = 'submitted', claims nothing, and returns
 * `{ scored: false }` — so a double-click or retried request can never score
 * twice or create two remediation records.
 *
 * Authorisation is NOT done here; callers must verify the attempt belongs to
 * the signed-in user first.
 */
export async function scoreAndRecordAttempt(ref: AttemptRef, database: Db = db): Promise<SubmitOutcome> {
  return database.transaction(async (tx) => {
    const [claimed] = await tx
      .update(s.attempts)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(and(eq(s.attempts.id, ref.attemptId), eq(s.attempts.status, "in_progress")))
      .returning({ id: s.attempts.id });
    if (!claimed) return { scored: false };

    const questions = await tx
      .select({ id: s.questions.id, lessonId: s.questions.lessonId })
      .from(s.questions)
      .where(eq(s.questions.quizId, ref.quizId))
      .orderBy(asc(s.questions.position));
    if (questions.length === 0) throw new Error("Quiz has no questions.");

    const opts = await tx
      .select({ id: s.options.id, questionId: s.options.questionId, isCorrect: s.options.isCorrect })
      .from(s.options)
      .where(inArray(s.options.questionId, questions.map((q) => q.id)));
    const saved = await tx.select().from(s.answers).where(eq(s.answers.attemptId, ref.attemptId));
    const picks: Record<string, string[]> = {};
    for (const a of saved) picks[a.questionId] = a.selectedOptionIds;

    const graded = scoreAttempt(
      questions.map((q) => ({
        id: q.id,
        correctOptionIds: opts.filter((o) => o.questionId === q.id && o.isCorrect).map((o) => o.id),
      })),
      picks,
    );

    // Store a verdict for every question — including ones left blank.
    await tx
      .insert(s.answers)
      .values(
        graded.results.map((r) => ({
          attemptId: ref.attemptId,
          questionId: r.questionId,
          selectedOptionIds: picks[r.questionId] ?? [],
          isCorrect: r.isCorrect,
        })),
      )
      .onConflictDoUpdate({
        target: [s.answers.attemptId, s.answers.questionId],
        set: { isCorrect: sql`excluded.is_correct` },
      });

    const [quiz] = await tx
      .select({ passScore: s.quizzes.passScore, escalateAfter: s.quizzes.escalateAfter })
      .from(s.quizzes)
      .where(eq(s.quizzes.id, ref.quizId));
    const moduleLessons = await tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.moduleId, ref.moduleId));
    const [{ priorFailed }] = await tx
      .select({ priorFailed: count() })
      .from(s.attempts)
      .where(
        and(
          eq(s.attempts.enrollmentId, ref.enrollmentId),
          eq(s.attempts.quizId, ref.quizId),
          eq(s.attempts.status, "submitted"),
          eq(s.attempts.passed, false),
        ),
      );
    const [open] = await tx
      .select({ id: s.remediationRecords.id })
      .from(s.remediationRecords)
      .where(
        and(
          eq(s.remediationRecords.enrollmentId, ref.enrollmentId),
          eq(s.remediationRecords.quizId, ref.quizId),
          inArray(s.remediationRecords.status, [...OPEN_REMEDIATION]),
        ),
      )
      .for("update");

    const decision = decideAfterSubmit({
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      passScore: quiz.passScore,
      escalateAfter: quiz.escalateAfter,
      priorFailedCount: priorFailed,
      missedQuestions: graded.results
        .filter((r) => !r.isCorrect)
        .map((r) => ({ questionId: r.questionId, lessonId: questions.find((q) => q.id === r.questionId)!.lessonId })),
      moduleLessonIds: moduleLessons.map((l) => l.id),
      openRemediationId: open?.id ?? null,
    });

    await tx
      .update(s.attempts)
      .set({
        score: graded.score,
        correctCount: graded.correctCount,
        totalCount: graded.totalCount,
        passed: decision.passed,
      })
      .where(eq(s.attempts.id, ref.attemptId));

    // Close the old open record BEFORE inserting the new one (partial unique index).
    if (decision.closeOpen) {
      await tx
        .update(s.remediationRecords)
        .set({
          status: decision.closeOpen.as,
          resolvedAt: new Date(),
          resolvedByAttemptId: decision.closeOpen.as === "resolved" ? ref.attemptId : null,
        })
        .where(eq(s.remediationRecords.id, decision.closeOpen.id));
    }
    if (decision.create) {
      const [record] = await tx
        .insert(s.remediationRecords)
        .values({
          enrollmentId: ref.enrollmentId,
          quizId: ref.quizId,
          attemptId: ref.attemptId,
          status: decision.create.status,
        })
        .returning({ id: s.remediationRecords.id });
      if (decision.create.lessonIds.length > 0) {
        await tx
          .insert(s.remediationItems)
          .values(decision.create.lessonIds.map((lessonId) => ({ remediationId: record.id, lessonId })));
      }
    }

    await tx.update(s.enrollments).set({ lastActivityAt: new Date() }).where(eq(s.enrollments.id, ref.enrollmentId));
    return { scored: true, score: graded.score, passed: decision.passed };
  });
}
