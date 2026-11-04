import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  OPEN_REMEDIATION,
  type CourseStructure,
  type EnrollmentState,
  type LessonNode,
  type ModuleNode,
  type OpenRemediation,
  type QuizNode,
} from "@/lib/learning/types";

export { OPEN_REMEDIATION };

export interface OutlineLesson extends LessonNode {
  type: "reading" | "video";
  durationMin: number;
}
export interface OutlineQuiz extends QuizNode {
  title: string;
  questionCount: number;
}
export interface OutlineModule extends ModuleNode {
  lessons: OutlineLesson[];
  quiz: OutlineQuiz | null;
}
/** A CourseStructure (what the pure logic needs) plus display fields. */
export interface CourseOutline extends CourseStructure {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  instructorId: string;
  orgId: string;
  modules: OutlineModule[];
}

type CourseKey = { id: string } | { slug: string };

export async function loadOutline(key: CourseKey): Promise<CourseOutline | null> {
  const [course] = await db
    .select({
      id: s.courses.id,
      slug: s.courses.slug,
      title: s.courses.title,
      status: s.courses.status,
      instructorId: s.courses.instructorId,
      orgId: s.courses.orgId,
    })
    .from(s.courses)
    .where("id" in key ? eq(s.courses.id, key.id) : eq(s.courses.slug, key.slug))
    .limit(1);
  if (!course) return null;

  const [mods, lessons, quizzes, questionCounts] = await Promise.all([
    db.select().from(s.modules).where(eq(s.modules.courseId, course.id)).orderBy(asc(s.modules.position)),
    db.select().from(s.lessons).where(eq(s.lessons.courseId, course.id)).orderBy(asc(s.lessons.position)),
    db.select().from(s.quizzes).where(eq(s.quizzes.courseId, course.id)),
    db
      .select({ quizId: s.questions.quizId, n: count() })
      .from(s.questions)
      .innerJoin(s.quizzes, eq(s.quizzes.id, s.questions.quizId))
      .where(eq(s.quizzes.courseId, course.id))
      .groupBy(s.questions.quizId),
  ]);

  const qCount = new Map(questionCounts.map((q) => [q.quizId, q.n]));

  return {
    ...course,
    modules: mods.map((m) => {
      const quiz = quizzes.find((q) => q.moduleId === m.id);
      return {
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: lessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            position: l.position,
            type: l.type,
            durationMin: l.durationMin,
          })),
        quiz: quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              passScore: quiz.passScore,
              escalateAfter: quiz.escalateAfter,
              questionCount: qCount.get(quiz.id) ?? 0,
            }
          : null,
      };
    }),
  };
}

/**
 * Builds the pure-logic EnrollmentState for many enrollments in five queries
 * total, so the dashboard and instructor tables don't N+1.
 */
export async function loadEnrollmentStates(enrollmentIds: string[]): Promise<Map<string, EnrollmentState>> {
  const out = new Map<string, EnrollmentState>();
  if (enrollmentIds.length === 0) return out;

  const [enrollments, progress, attempts, records] = await Promise.all([
    db
      .select({ id: s.enrollments.id, lastLessonId: s.enrollments.lastLessonId })
      .from(s.enrollments)
      .where(inArray(s.enrollments.id, enrollmentIds)),
    db
      .select({ enrollmentId: s.lessonProgress.enrollmentId, lessonId: s.lessonProgress.lessonId })
      .from(s.lessonProgress)
      .where(and(inArray(s.lessonProgress.enrollmentId, enrollmentIds), eq(s.lessonProgress.status, "completed"))),
    db
      .select({
        id: s.attempts.id,
        enrollmentId: s.attempts.enrollmentId,
        quizId: s.attempts.quizId,
        status: s.attempts.status,
        passed: s.attempts.passed,
      })
      .from(s.attempts)
      .where(inArray(s.attempts.enrollmentId, enrollmentIds)),
    db
      .select({
        id: s.remediationRecords.id,
        enrollmentId: s.remediationRecords.enrollmentId,
        quizId: s.remediationRecords.quizId,
        attemptId: s.remediationRecords.attemptId,
        status: s.remediationRecords.status,
      })
      .from(s.remediationRecords)
      .where(
        and(
          inArray(s.remediationRecords.enrollmentId, enrollmentIds),
          inArray(s.remediationRecords.status, [...OPEN_REMEDIATION]),
        ),
      ),
  ]);

  const items = records.length
    ? await db
        .select()
        .from(s.remediationItems)
        .where(inArray(s.remediationItems.remediationId, records.map((r) => r.id)))
    : [];

  for (const e of enrollments) {
    out.set(e.id, {
      completedLessonIds: [],
      passedQuizIds: [],
      inProgressAttempts: {},
      openRemediation: {},
      lastLessonId: e.lastLessonId,
    });
  }
  for (const p of progress) out.get(p.enrollmentId)?.completedLessonIds.push(p.lessonId);
  for (const a of attempts) {
    const st = out.get(a.enrollmentId);
    if (!st) continue;
    if (a.status === "in_progress") st.inProgressAttempts[a.quizId] = a.id;
    else if (a.passed && !st.passedQuizIds.includes(a.quizId)) st.passedQuizIds.push(a.quizId);
  }
  for (const r of records) {
    const open: OpenRemediation = {
      id: r.id,
      attemptId: r.attemptId,
      status: r.status as OpenRemediation["status"],
      items: items.filter((i) => i.remediationId === r.id).map((i) => ({ lessonId: i.lessonId, completed: i.completedAt !== null })),
    };
    const st = out.get(r.enrollmentId);
    if (st) st.openRemediation[r.quizId] = open;
  }
  return out;
}

export async function loadEnrollmentState(enrollmentId: string): Promise<EnrollmentState> {
  const states = await loadEnrollmentStates([enrollmentId]);
  const st = states.get(enrollmentId);
  if (!st) throw new Error(`Enrollment ${enrollmentId} not found`);
  return st;
}

/** The learner's enrollment for a course, or null. Always scoped to the user. */
export async function getEnrollment(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(s.enrollments)
    .where(and(eq(s.enrollments.userId, userId), eq(s.enrollments.courseId, courseId)))
    .limit(1);
  return row ?? null;
}
