import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/session";
import { getNextAction } from "@/lib/learning/next-action";
import { computeProgress } from "@/lib/learning/progress";
import { isAtRisk, learnerStatus, type LearnerStatus } from "@/lib/learning/risk";
import { loadEnrollmentStates, loadOutline, type CourseOutline } from "./learning";

/** Instructors manage their own courses; admins manage every course in their org. */
export function canManage(user: CurrentUser, course: { orgId: string; instructorId: string }): boolean {
  if (course.orgId !== user.orgId) return false;
  return user.role === "admin" || (user.role === "instructor" && course.instructorId === user.id);
}

export async function getManagedCourse(user: CurrentUser, courseId: string) {
  const [course] = await db
    .select({
      id: s.courses.id,
      orgId: s.courses.orgId,
      instructorId: s.courses.instructorId,
      slug: s.courses.slug,
      title: s.courses.title,
      summary: s.courses.summary,
      description: s.courses.description,
      category: s.courses.category,
      level: s.courses.level,
      coverTheme: s.courses.coverTheme,
      status: s.courses.status,
      instructorName: s.users.name,
    })
    .from(s.courses)
    .innerJoin(s.users, eq(s.users.id, s.courses.instructorId))
    .where(eq(s.courses.id, courseId))
    .limit(1);
  return course && canManage(user, course) ? course : null;
}

export interface RosterRow {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  percent: number;
  doneUnits: number;
  totalUnits: number;
  status: LearnerStatus;
  lastActivityAt: Date;
  enrolledAt: Date;
  nextLabel: string;
  /** quizId → best score so far */
  bestScores: Record<string, number>;
  failedAttempts: number;
}

/**
 * Every learner in a course with progress computed by the SAME functions the
 * learner dashboard uses (computeProgress / getNextAction), so what an
 * instructor sees is exactly what the learner sees.
 */
export async function getCourseRoster(courseId: string, now = new Date()): Promise<{ outline: CourseOutline; rows: RosterRow[] } | null> {
  const outline = await loadOutline({ id: courseId });
  if (!outline) return null;

  const enrolled = await db
    .select({
      enrollmentId: s.enrollments.id,
      userId: s.users.id,
      name: s.users.name,
      email: s.users.email,
      lastActivityAt: s.enrollments.lastActivityAt,
      enrolledAt: s.enrollments.enrolledAt,
    })
    .from(s.enrollments)
    .innerJoin(s.users, eq(s.users.id, s.enrollments.userId))
    .where(eq(s.enrollments.courseId, courseId))
    .orderBy(asc(s.users.name));
  if (enrolled.length === 0) return { outline, rows: [] };

  const ids = enrolled.map((e) => e.enrollmentId);
  const [states, attempts] = await Promise.all([
    loadEnrollmentStates(ids),
    db
      .select({
        enrollmentId: s.attempts.enrollmentId,
        quizId: s.attempts.quizId,
        score: s.attempts.score,
        passed: s.attempts.passed,
      })
      .from(s.attempts)
      .where(and(inArray(s.attempts.enrollmentId, ids), eq(s.attempts.status, "submitted"))),
  ]);

  const rows = enrolled.map<RosterRow>((e) => {
    const state = states.get(e.enrollmentId)!;
    const progress = computeProgress(outline, state);
    const mine = attempts.filter((a) => a.enrollmentId === e.enrollmentId);
    const bestScores: Record<string, number> = {};
    for (const a of mine) bestScores[a.quizId] = Math.max(bestScores[a.quizId] ?? 0, a.score ?? 0);

    return {
      ...e,
      percent: progress.percent,
      doneUnits: progress.doneUnits,
      totalUnits: progress.totalUnits,
      status: learnerStatus({
        complete: progress.isComplete,
        doneUnits: progress.doneUnits,
        lastActivityAt: e.lastActivityAt,
        now,
        openRemediation: Object.values(state.openRemediation).map((r) => r.status),
      }),
      nextLabel: getNextAction(outline, state).label,
      bestScores,
      failedAttempts: mine.filter((a) => a.passed === false).length,
    };
  });
  return { outline, rows };
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  coverTheme: string;
  instructorName: string;
  enrolled: number;
  avgProgress: number;
  completed: number;
  atRisk: number;
}

export interface AtRiskRow extends RosterRow {
  courseId: string;
  courseTitle: string;
}

/** Dashboard data: one summary per managed course plus a flat at-risk list. */
export async function getInstructorOverview(user: CurrentUser) {
  const courses = await db
    .select({
      id: s.courses.id,
      title: s.courses.title,
      slug: s.courses.slug,
      status: s.courses.status,
      coverTheme: s.courses.coverTheme,
      instructorName: s.users.name,
    })
    .from(s.courses)
    .innerJoin(s.users, eq(s.users.id, s.courses.instructorId))
    .where(
      and(eq(s.courses.orgId, user.orgId), user.role === "admin" ? undefined : eq(s.courses.instructorId, user.id)),
    )
    .orderBy(desc(s.courses.updatedAt));

  const rosters = await Promise.all(courses.map((c) => getCourseRoster(c.id)));

  const summaries: CourseSummary[] = [];
  const atRisk: AtRiskRow[] = [];
  courses.forEach((c, i) => {
    const rows = rosters[i]?.rows ?? [];
    summaries.push({
      ...c,
      enrolled: rows.length,
      avgProgress: rows.length ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length) : 0,
      completed: rows.filter((r) => r.status === "completed").length,
      atRisk: rows.filter((r) => isAtRisk(r.status)).length,
    });
    for (const r of rows) if (isAtRisk(r.status)) atRisk.push({ ...r, courseId: c.id, courseTitle: c.title });
  });

  atRisk.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
  return { courses: summaries, atRisk };
}

export interface LessonFunnelPoint {
  lessonId: string;
  label: string;
  title: string;
  completed: number;
}
export interface QuizInsight {
  quizId: string;
  title: string;
  attempts: number;
  learners: number;
  passRate: number | null;
  avgScore: number | null;
}
export interface HardQuestion {
  questionId: string;
  prompt: string;
  quizTitle: string;
  answered: number;
  missRate: number;
}

export async function getCourseInsights(outline: CourseOutline) {
  const quizIds = outline.modules.flatMap((m) => (m.quiz ? [m.quiz.id] : []));

  const [completions, quizRows, questionRows] = await Promise.all([
    db
      .select({ lessonId: s.lessonProgress.lessonId, n: sql<number>`count(*)::int` })
      .from(s.lessonProgress)
      .innerJoin(s.enrollments, eq(s.enrollments.id, s.lessonProgress.enrollmentId))
      .where(and(eq(s.enrollments.courseId, outline.id), eq(s.lessonProgress.status, "completed")))
      .groupBy(s.lessonProgress.lessonId),
    quizIds.length
      ? db
          .select({
            quizId: s.attempts.quizId,
            attempts: sql<number>`count(*)::int`,
            learners: sql<number>`count(distinct ${s.attempts.enrollmentId})::int`,
            passed: sql<number>`count(*) filter (where ${s.attempts.passed})::int`,
            avgScore: sql<number | null>`round(avg(${s.attempts.score}))::int`,
          })
          .from(s.attempts)
          .where(and(inArray(s.attempts.quizId, quizIds), eq(s.attempts.status, "submitted")))
          .groupBy(s.attempts.quizId)
      : Promise.resolve([]),
    quizIds.length
      ? db
          .select({
            questionId: s.questions.id,
            prompt: s.questions.prompt,
            quizId: s.questions.quizId,
            answered: sql<number>`count(${s.answers.id})::int`,
            missed: sql<number>`count(*) filter (where ${s.answers.isCorrect} = false)::int`,
          })
          .from(s.questions)
          .innerJoin(s.answers, eq(s.answers.questionId, s.questions.id))
          .innerJoin(s.attempts, and(eq(s.attempts.id, s.answers.attemptId), eq(s.attempts.status, "submitted")))
          .where(inArray(s.questions.quizId, quizIds))
          .groupBy(s.questions.id, s.questions.prompt, s.questions.quizId)
      : Promise.resolve([]),
  ]);

  const done = new Map(completions.map((c) => [c.lessonId, c.n]));
  const funnel: LessonFunnelPoint[] = [];
  [...outline.modules]
    .sort((a, b) => a.position - b.position)
    .forEach((m, mi) => {
      [...m.lessons]
        .sort((a, b) => a.position - b.position)
        .forEach((l, li) => {
          funnel.push({ lessonId: l.id, label: `${mi + 1}.${li + 1}`, title: l.title, completed: done.get(l.id) ?? 0 });
        });
    });

  const quizTitle = new Map(outline.modules.flatMap((m) => (m.quiz ? [[m.quiz.id, m.quiz.title] as const] : [])));
  const quizzes: QuizInsight[] = quizIds.map((id) => {
    const row = quizRows.find((r) => r.quizId === id);
    return {
      quizId: id,
      title: quizTitle.get(id) ?? "Quiz",
      attempts: row?.attempts ?? 0,
      learners: row?.learners ?? 0,
      passRate: row && row.attempts > 0 ? Math.round((row.passed / row.attempts) * 100) : null,
      avgScore: row?.avgScore ?? null,
    };
  });

  const hardest: HardQuestion[] = questionRows
    .filter((q) => q.answered >= 1)
    .map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      quizTitle: quizTitle.get(q.quizId) ?? "Quiz",
      answered: q.answered,
      missRate: Math.round((q.missed / q.answered) * 100),
    }))
    .sort((a, b) => b.missRate - a.missRate || b.answered - a.answered)
    .slice(0, 5);

  return { funnel, quizzes, hardest };
}
