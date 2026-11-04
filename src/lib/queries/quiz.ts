import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export interface RunnerQuestion {
  id: string;
  prompt: string;
  type: "single" | "multiple" | "true_false";
  options: { id: string; text: string }[];
}

/**
 * Questions for an in-progress attempt. Deliberately selects NO `isCorrect`
 * column: the answer key never leaves the server until the attempt is submitted.
 */
export async function getRunnerData(quizId: string, attemptId: string) {
  const questions = await db
    .select({ id: s.questions.id, prompt: s.questions.prompt, type: s.questions.type })
    .from(s.questions)
    .where(eq(s.questions.quizId, quizId))
    .orderBy(asc(s.questions.position));

  const [options, saved] = await Promise.all([
    questions.length
      ? db
          .select({ id: s.options.id, questionId: s.options.questionId, text: s.options.text })
          .from(s.options)
          .where(inArray(s.options.questionId, questions.map((q) => q.id)))
          .orderBy(asc(s.options.position))
      : Promise.resolve([]),
    db
      .select({ questionId: s.answers.questionId, selectedOptionIds: s.answers.selectedOptionIds })
      .from(s.answers)
      .where(eq(s.answers.attemptId, attemptId)),
  ]);

  return {
    questions: questions.map<RunnerQuestion>((q) => ({
      ...q,
      options: options.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text })),
    })),
    saved: Object.fromEntries(saved.map((a) => [a.questionId, a.selectedOptionIds])) as Record<string, string[]>,
  };
}

export interface ReviewedQuestion {
  id: string;
  prompt: string;
  explanation: string | null;
  isCorrect: boolean;
  selected: string[];
  correct: string[];
  lessonId: string | null;
  lessonTitle: string | null;
}

export interface RemediationView {
  id: string;
  status: "required" | "ready" | "resolved" | "superseded" | "escalated";
  items: { lessonId: string; lessonTitle: string; completed: boolean }[];
}

/** A submitted attempt with its answer key, owned by `userId`; null otherwise. */
export async function getAttemptResult(attemptId: string, userId: string) {
  const [attempt] = await db
    .select({
      id: s.attempts.id,
      attemptNo: s.attempts.attemptNo,
      status: s.attempts.status,
      score: s.attempts.score,
      correctCount: s.attempts.correctCount,
      totalCount: s.attempts.totalCount,
      passed: s.attempts.passed,
      submittedAt: s.attempts.submittedAt,
      enrollmentId: s.attempts.enrollmentId,
      quizId: s.quizzes.id,
      quizTitle: s.quizzes.title,
      passScore: s.quizzes.passScore,
      escalateAfter: s.quizzes.escalateAfter,
    })
    .from(s.attempts)
    .innerJoin(s.enrollments, eq(s.enrollments.id, s.attempts.enrollmentId))
    .innerJoin(s.quizzes, eq(s.quizzes.id, s.attempts.quizId))
    .where(and(eq(s.attempts.id, attemptId), eq(s.enrollments.userId, userId)))
    .limit(1);
  if (!attempt || attempt.status !== "submitted") return null;

  const rows = await db
    .select({
      id: s.questions.id,
      prompt: s.questions.prompt,
      explanation: s.questions.explanation,
      lessonId: s.questions.lessonId,
      lessonTitle: s.lessons.title,
      selectedOptionIds: s.answers.selectedOptionIds,
      isCorrect: s.answers.isCorrect,
    })
    .from(s.questions)
    .leftJoin(s.lessons, eq(s.lessons.id, s.questions.lessonId))
    .leftJoin(s.answers, and(eq(s.answers.questionId, s.questions.id), eq(s.answers.attemptId, attemptId)))
    .where(eq(s.questions.quizId, attempt.quizId))
    .orderBy(asc(s.questions.position));

  const options = rows.length
    ? await db
        .select({ id: s.options.id, questionId: s.options.questionId, text: s.options.text, isCorrect: s.options.isCorrect })
        .from(s.options)
        .where(inArray(s.options.questionId, rows.map((r) => r.id)))
        .orderBy(asc(s.options.position))
    : [];

  const questions = rows.map<ReviewedQuestion>((r) => {
    const own = options.filter((o) => o.questionId === r.id);
    const selected = r.selectedOptionIds ?? [];
    return {
      id: r.id,
      prompt: r.prompt,
      explanation: r.explanation,
      isCorrect: r.isCorrect ?? false,
      selected: own.filter((o) => selected.includes(o.id)).map((o) => o.text),
      correct: own.filter((o) => o.isCorrect).map((o) => o.text),
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
    };
  });

  // The record this attempt created (if it failed), plus its review items.
  const [record] = await db
    .select({ id: s.remediationRecords.id, status: s.remediationRecords.status })
    .from(s.remediationRecords)
    .where(eq(s.remediationRecords.attemptId, attemptId))
    .limit(1);

  let remediation: RemediationView | null = null;
  if (record) {
    const items = await db
      .select({ lessonId: s.lessons.id, lessonTitle: s.lessons.title, completedAt: s.remediationItems.completedAt })
      .from(s.remediationItems)
      .innerJoin(s.lessons, eq(s.lessons.id, s.remediationItems.lessonId))
      .where(eq(s.remediationItems.remediationId, record.id))
      .orderBy(asc(s.lessons.position));
    remediation = {
      id: record.id,
      status: record.status,
      items: items.map((i) => ({ lessonId: i.lessonId, lessonTitle: i.lessonTitle, completed: i.completedAt !== null })),
    };
  }

  // Failed attempts so far, to show "attempt N of escalateAfter".
  const failedBefore = await db
    .select({ id: s.attempts.id })
    .from(s.attempts)
    .where(
      and(
        eq(s.attempts.enrollmentId, attempt.enrollmentId),
        eq(s.attempts.quizId, attempt.quizId),
        eq(s.attempts.status, "submitted"),
        eq(s.attempts.passed, false),
      ),
    );

  return { attempt, questions, remediation, failedCount: failedBefore.length };
}
