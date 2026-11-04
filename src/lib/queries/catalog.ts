import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export interface CatalogCourse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  coverTheme: string;
  estimatedMinutes: number;
  instructorName: string;
  lessonCount: number;
  learnerCount: number;
}

export interface CatalogFilters {
  q?: string;
  category?: string;
  level?: string;
}

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

/** Org that signed-out visitors browse and that /register joins. */
export async function getDefaultOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORG_SLUG ?? "northwind-academy";
  const [org] = await db.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, slug)).limit(1);
  return org?.id ?? null;
}

const courseColumns = {
  id: s.courses.id,
  slug: s.courses.slug,
  title: s.courses.title,
  summary: s.courses.summary,
  category: s.courses.category,
  level: s.courses.level,
  coverTheme: s.courses.coverTheme,
  estimatedMinutes: s.courses.estimatedMinutes,
  instructorName: s.users.name,
  lessonCount: sql<number>`(select count(*)::int from ${s.lessons} where ${s.lessons.courseId} = ${s.courses.id})`,
  learnerCount: sql<number>`(select count(*)::int from ${s.enrollments} where ${s.enrollments.courseId} = ${s.courses.id})`,
};

export async function listCatalog(orgId: string, filters: CatalogFilters = {}): Promise<CatalogCourse[]> {
  const conditions = [eq(s.courses.orgId, orgId), eq(s.courses.status, "published")];

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(s.courses.title, pattern), ilike(s.courses.summary, pattern))!);
  }
  if (filters.category) conditions.push(eq(s.courses.category, filters.category));
  if (filters.level && (LEVELS as readonly string[]).includes(filters.level)) {
    conditions.push(eq(s.courses.level, filters.level as (typeof LEVELS)[number]));
  }

  return db
    .select(courseColumns)
    .from(s.courses)
    .innerJoin(s.users, eq(s.users.id, s.courses.instructorId))
    .where(and(...conditions))
    .orderBy(desc(s.courses.createdAt), asc(s.courses.title));
}

export async function getEnrolledCourseIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ courseId: s.enrollments.courseId })
    .from(s.enrollments)
    .where(eq(s.enrollments.userId, userId));
  return new Set(rows.map((r) => r.courseId));
}

export async function listCategories(orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: s.courses.category })
    .from(s.courses)
    .where(and(eq(s.courses.orgId, orgId), eq(s.courses.status, "published")))
    .orderBy(asc(s.courses.category));
  return rows.map((r) => r.category);
}

export async function getCourseDetail(slug: string, orgId: string) {
  const [course] = await db
    .select({ ...courseColumns, description: s.courses.description, status: s.courses.status })
    .from(s.courses)
    .innerJoin(s.users, eq(s.users.id, s.courses.instructorId))
    .where(and(eq(s.courses.slug, slug), eq(s.courses.orgId, orgId), eq(s.courses.status, "published")))
    .limit(1);
  return course ?? null;
}
