import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export async function getOrgSummary(orgId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [byRole, byStatus, enrollment, quiz] = await Promise.all([
    db
      .select({ role: s.users.role, n: sql<number>`count(*)::int` })
      .from(s.users)
      .where(and(eq(s.users.orgId, orgId), eq(s.users.status, "active")))
      .groupBy(s.users.role),
    db
      .select({ status: s.courses.status, n: sql<number>`count(*)::int` })
      .from(s.courses)
      .where(eq(s.courses.orgId, orgId))
      .groupBy(s.courses.status),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${s.enrollments.status} = 'completed')::int`,
        active7: sql<number>`count(distinct ${s.enrollments.userId}) filter (where ${s.enrollments.lastActivityAt} >= ${weekAgo})::int`,
      })
      .from(s.enrollments)
      .innerJoin(s.courses, eq(s.courses.id, s.enrollments.courseId))
      .where(eq(s.courses.orgId, orgId)),
    db
      .select({
        attempts: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${s.attempts.passed})::int`,
      })
      .from(s.attempts)
      .innerJoin(s.quizzes, eq(s.quizzes.id, s.attempts.quizId))
      .innerJoin(s.courses, eq(s.courses.id, s.quizzes.courseId))
      .where(and(eq(s.courses.orgId, orgId), eq(s.attempts.status, "submitted"))),
  ]);

  const roles = Object.fromEntries(byRole.map((r) => [r.role, r.n])) as Partial<Record<"learner" | "instructor" | "admin", number>>;
  const courses = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<"draft" | "published" | "archived", number>>;
  const e = enrollment[0] ?? { total: 0, completed: 0, active7: 0 };
  const q = quiz[0] ?? { attempts: 0, passed: 0 };

  return {
    roles,
    courses,
    enrollments: e.total,
    completions: e.completed,
    activeLearners7d: e.active7,
    quizAttempts: q.attempts,
    quizPassRate: q.attempts > 0 ? Math.round((q.passed / q.attempts) * 100) : null,
  };
}

export async function listOrgUsers(orgId: string) {
  return db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      role: s.users.role,
      status: s.users.status,
      createdAt: s.users.createdAt,
      enrollments: sql<number>`(select count(*)::int from ${s.enrollments} where ${s.enrollments.userId} = ${s.users.id})`,
      ownedCourses: sql<number>`(select count(*)::int from ${s.courses} where ${s.courses.instructorId} = ${s.users.id})`,
    })
    .from(s.users)
    .where(eq(s.users.orgId, orgId))
    .orderBy(asc(s.users.role), asc(s.users.name));
}

export async function listOrgCourses(orgId: string) {
  return db
    .select({
      id: s.courses.id,
      title: s.courses.title,
      slug: s.courses.slug,
      status: s.courses.status,
      instructorId: s.courses.instructorId,
      instructorName: s.users.name,
      updatedAt: s.courses.updatedAt,
      enrolled: sql<number>`(select count(*)::int from ${s.enrollments} where ${s.enrollments.courseId} = ${s.courses.id})`,
    })
    .from(s.courses)
    .innerJoin(s.users, eq(s.users.id, s.courses.instructorId))
    .where(eq(s.courses.orgId, orgId))
    .orderBy(desc(s.courses.updatedAt));
}

export async function listInstructors(orgId: string) {
  return db
    .select({ id: s.users.id, name: s.users.name, role: s.users.role })
    .from(s.users)
    .where(and(eq(s.users.orgId, orgId), eq(s.users.status, "active"), sql`${s.users.role} in ('instructor', 'admin')`))
    .orderBy(asc(s.users.name));
}
