import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getNextAction, type NextAction } from "@/lib/learning/next-action";
import { computeProgress, type CourseProgress } from "@/lib/learning/progress";
import { loadEnrollmentStates, loadOutline, type CourseOutline } from "./learning";

export interface LearnerCourse {
  enrollmentId: string;
  status: "active" | "completed" | "dropped";
  lastActivityAt: Date;
  enrolledAt: Date;
  outline: CourseOutline;
  progress: CourseProgress;
  next: NextAction;
  coverTheme: string;
  category: string;
}

/** Every course the learner is enrolled in, with progress and the single next action. */
export async function getLearnerCourses(userId: string): Promise<LearnerCourse[]> {
  const rows = await db
    .select({
      enrollmentId: s.enrollments.id,
      status: s.enrollments.status,
      lastActivityAt: s.enrollments.lastActivityAt,
      enrolledAt: s.enrollments.enrolledAt,
      courseId: s.courses.id,
      coverTheme: s.courses.coverTheme,
      category: s.courses.category,
    })
    .from(s.enrollments)
    .innerJoin(s.courses, eq(s.courses.id, s.enrollments.courseId))
    .where(and(eq(s.enrollments.userId, userId)))
    .orderBy(desc(s.enrollments.lastActivityAt));

  const [states, outlines] = await Promise.all([
    loadEnrollmentStates(rows.map((r) => r.enrollmentId)),
    Promise.all(rows.map((r) => loadOutline({ id: r.courseId }))),
  ]);

  const result: LearnerCourse[] = [];
  rows.forEach((r, i) => {
    const outline = outlines[i];
    const state = states.get(r.enrollmentId);
    if (!outline || !state) return;
    const progress = computeProgress(outline, state);
    result.push({
      enrollmentId: r.enrollmentId,
      status: progress.isComplete ? "completed" : r.status,
      lastActivityAt: r.lastActivityAt,
      enrolledAt: r.enrolledAt,
      outline,
      progress,
      next: getNextAction(outline, state),
      coverTheme: r.coverTheme,
      category: r.category,
    });
  });
  return result;
}

export interface NoteRow {
  id: string;
  kind: "note" | "bookmark";
  body: string | null;
  createdAt: Date;
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
}

export async function getNotes(userId: string, limit?: number): Promise<NoteRow[]> {
  const query = db
    .select({
      id: s.notes.id,
      kind: s.notes.kind,
      body: s.notes.body,
      createdAt: s.notes.createdAt,
      lessonId: s.lessons.id,
      lessonTitle: s.lessons.title,
      courseSlug: s.courses.slug,
      courseTitle: s.courses.title,
    })
    .from(s.notes)
    .innerJoin(s.lessons, eq(s.lessons.id, s.notes.lessonId))
    .innerJoin(s.courses, eq(s.courses.id, s.lessons.courseId))
    .where(eq(s.notes.userId, userId))
    .orderBy(desc(s.notes.createdAt));
  return limit ? query.limit(limit) : query;
}

export interface QuizHistoryRow {
  attemptId: string;
  attemptNo: number;
  score: number;
  passed: boolean;
  submittedAt: Date;
  quizId: string;
  quizTitle: string;
  passScore: number;
  courseSlug: string;
  courseTitle: string;
}

/** Submitted attempts, oldest first, for the score-history chart. */
export async function getQuizHistory(userId: string): Promise<QuizHistoryRow[]> {
  const rows = await db
    .select({
      attemptId: s.attempts.id,
      attemptNo: s.attempts.attemptNo,
      score: s.attempts.score,
      passed: s.attempts.passed,
      submittedAt: s.attempts.submittedAt,
      quizId: s.quizzes.id,
      quizTitle: s.quizzes.title,
      passScore: s.quizzes.passScore,
      courseSlug: s.courses.slug,
      courseTitle: s.courses.title,
    })
    .from(s.attempts)
    .innerJoin(s.enrollments, eq(s.enrollments.id, s.attempts.enrollmentId))
    .innerJoin(s.quizzes, eq(s.quizzes.id, s.attempts.quizId))
    .innerJoin(s.courses, eq(s.courses.id, s.quizzes.courseId))
    .where(and(eq(s.enrollments.userId, userId), eq(s.attempts.status, "submitted")))
    .orderBy(asc(s.attempts.submittedAt));

  return rows.flatMap((r) =>
    r.score === null || r.passed === null || r.submittedAt === null
      ? []
      : [{ ...r, score: r.score, passed: r.passed, submittedAt: r.submittedAt }],
  );
}
