"use server";

import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

const uuid = z.uuid();

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  role: z.enum(ROLES),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export type CreateUserState =
  | { error?: string; fieldErrors?: Record<string, string>; created?: string }
  | undefined;

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const admin = await requireRole("admin");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, parsed.data.email)).limit(1);
  if (existing) return { fieldErrors: { email: "An account with this email already exists." } };

  await db.insert(s.users).values({
    orgId: admin.orgId,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { created: parsed.data.name };
}

/** Loads a user in the admin's own org; anything else is "not found". */
async function targetUser(adminOrgId: string, userId: string) {
  if (!uuid.safeParse(userId).success) return null;
  const [user] = await db
    .select({ id: s.users.id, role: s.users.role, status: s.users.status })
    .from(s.users)
    .where(and(eq(s.users.id, userId), eq(s.users.orgId, adminOrgId)))
    .limit(1);
  return user ?? null;
}

export async function setUserRoleAction(userId: string, role: string): Promise<Result> {
  const admin = await requireRole("admin");
  const parsedRole = z.enum(ROLES).safeParse(role);
  if (!parsedRole.success) return { ok: false, error: "Unknown role." };
  const user = await targetUser(admin.orgId, userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.id === admin.id) return { ok: false, error: "You can't change your own role." };

  if (parsedRole.data === "learner" && user.role !== "learner") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.courses)
      .where(eq(s.courses.instructorId, user.id));
    if (n > 0) return { ok: false, error: `They own ${n} ${n === 1 ? "course" : "courses"} — reassign ${n === 1 ? "it" : "them"} first.` };
  }

  await db.update(s.users).set({ role: parsedRole.data }).where(eq(s.users.id, user.id));
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserStatusAction(userId: string, status: "active" | "suspended"): Promise<Result> {
  const admin = await requireRole("admin");
  if (status !== "active" && status !== "suspended") return { ok: false, error: "Unknown status." };
  const user = await targetUser(admin.orgId, userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.id === admin.id) return { ok: false, error: "You can't suspend your own account." };

  // Takes effect on their very next request: requireUser() checks status against the database.
  await db.update(s.users).set({ status }).where(eq(s.users.id, user.id));
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}

export async function reassignCourseAction(courseId: string, instructorId: string): Promise<Result> {
  const admin = await requireRole("admin");
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(instructorId).success) return { ok: false, error: "Invalid selection." };

  const [course] = await db
    .select({ id: s.courses.id })
    .from(s.courses)
    .where(and(eq(s.courses.id, courseId), eq(s.courses.orgId, admin.orgId)))
    .limit(1);
  if (!course) return { ok: false, error: "Course not found." };

  const [instructor] = await db
    .select({ id: s.users.id, role: s.users.role, status: s.users.status })
    .from(s.users)
    .where(and(eq(s.users.id, instructorId), eq(s.users.orgId, admin.orgId)))
    .limit(1);
  if (!instructor || instructor.status !== "active" || instructor.role === "learner") {
    return { ok: false, error: "Choose an active instructor or admin from your organization." };
  }

  await db.update(s.courses).set({ instructorId: instructor.id, updatedAt: new Date() }).where(eq(s.courses.id, course.id));
  revalidatePath("/admin/courses");
  revalidatePath("/instructor");
  return { ok: true };
}
