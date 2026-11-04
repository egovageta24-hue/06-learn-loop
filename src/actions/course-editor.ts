"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { COVER_THEME_KEYS, LEVEL_KEYS } from "@/lib/format";
import { getManagedCourse } from "@/lib/queries/instructor";
import { validateCourseForPublish } from "@/lib/queries/publish";
import { slugify } from "@/lib/slug";

export type EditorFormState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; savedAt?: number }
  | undefined;

const uuid = z.uuid();
const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? "form"), i.message]));

// ---------------------------------------------------------------------------
// Authorisation: every action resolves its target back to a course the caller may manage.
// ---------------------------------------------------------------------------

async function ownCourse(courseId: string) {
  const user = await requireRole("instructor", "admin");
  if (!uuid.safeParse(courseId).success) notFound();
  const course = await getManagedCourse(user, courseId);
  if (!course) notFound();
  return { user, course };
}

async function viaModule(moduleId: string) {
  if (!uuid.safeParse(moduleId).success) notFound();
  const [m] = await db.select({ courseId: s.modules.courseId }).from(s.modules).where(eq(s.modules.id, moduleId)).limit(1);
  if (!m) notFound();
  return { ...(await ownCourse(m.courseId)), moduleId };
}

async function viaLesson(lessonId: string) {
  if (!uuid.safeParse(lessonId).success) notFound();
  const [l] = await db
    .select({ courseId: s.lessons.courseId, moduleId: s.lessons.moduleId })
    .from(s.lessons)
    .where(eq(s.lessons.id, lessonId))
    .limit(1);
  if (!l) notFound();
  return { ...(await ownCourse(l.courseId)), lessonId, moduleId: l.moduleId };
}

async function viaQuiz(quizId: string) {
  if (!uuid.safeParse(quizId).success) notFound();
  const [q] = await db
    .select({ courseId: s.quizzes.courseId, moduleId: s.quizzes.moduleId })
    .from(s.quizzes)
    .where(eq(s.quizzes.id, quizId))
    .limit(1);
  if (!q) notFound();
  return { ...(await ownCourse(q.courseId)), quizId, moduleId: q.moduleId };
}

async function viaQuestion(questionId: string) {
  if (!uuid.safeParse(questionId).success) notFound();
  const [q] = await db
    .select({ quizId: s.questions.quizId })
    .from(s.questions)
    .where(eq(s.questions.id, questionId))
    .limit(1);
  if (!q) notFound();
  return { ...(await viaQuiz(q.quizId)), questionId };
}

/** Keeps derived course fields fresh and refreshes every page that shows the course. */
async function touch(courseId: string) {
  await db
    .update(s.courses)
    .set({
      updatedAt: new Date(),
      estimatedMinutes: sql`greatest(1, coalesce((select sum(${s.lessons.durationMin}) from ${s.lessons} where ${s.lessons.courseId} = ${courseId}), 0))`,
    })
    .where(eq(s.courses.id, courseId));
  revalidatePath(`/instructor/courses/${courseId}`, "layout");
  revalidatePath("/instructor");
}

function swapped(ids: string[], id: string, dir: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

const courseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a title (3+ characters).").max(100),
  summary: z.string().trim().max(200, "Keep the summary under 200 characters.").default(""),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().min(1, "Choose a category.").max(40),
  level: z.enum(LEVEL_KEYS),
  coverTheme: z.enum(COVER_THEME_KEYS),
});

export async function createCourseAction(_prev: EditorFormState, formData: FormData): Promise<EditorFormState> {
  const user = await requireRole("instructor", "admin");
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const base = slugify(parsed.data.title);
  let slug = base;
  for (let n = 2; ; n++) {
    const [taken] = await db.select({ id: s.courses.id }).from(s.courses).where(eq(s.courses.slug, slug)).limit(1);
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const created = await db.transaction(async (tx) => {
    const [course] = await tx
      .insert(s.courses)
      .values({ ...parsed.data, slug, orgId: user.orgId, instructorId: user.id, status: "draft" })
      .returning({ id: s.courses.id });
    await tx.insert(s.modules).values({ courseId: course.id, title: "Module 1", position: 1 });
    return course;
  });

  revalidatePath("/instructor");
  redirect(`/instructor/courses/${created.id}/edit`);
}

export async function updateCourseAction(courseId: string, _prev: EditorFormState, formData: FormData): Promise<EditorFormState> {
  const { course } = await ownCourse(courseId);
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  await db.update(s.courses).set(parsed.data).where(eq(s.courses.id, course.id));
  await touch(course.id);
  revalidatePath(`/courses/${course.slug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function setCourseStatusAction(
  courseId: string,
  status: "draft" | "published" | "archived",
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const { course } = await ownCourse(courseId);
  if (!["draft", "published", "archived"].includes(status)) return { ok: false, errors: ["Unknown status."] };

  if (status === "published") {
    const problems = await validateCourseForPublish(course.id);
    if (problems.length > 0) return { ok: false, errors: problems };
  }
  await db.update(s.courses).set({ status, updatedAt: new Date() }).where(eq(s.courses.id, course.id));
  await touch(course.id);
  revalidatePath("/courses");
  revalidatePath(`/courses/${course.slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function addModuleAction(courseId: string): Promise<void> {
  const { course } = await ownCourse(courseId);
  const existing = await db.select({ id: s.modules.id }).from(s.modules).where(eq(s.modules.courseId, course.id));
  await db
    .insert(s.modules)
    .values({ courseId: course.id, title: `Module ${existing.length + 1}`, position: existing.length + 1 });
  await touch(course.id);
}

export async function renameModuleAction(moduleId: string, formData: FormData): Promise<void> {
  const { course } = await viaModule(moduleId);
  const title = z.string().trim().min(1).max(100).safeParse(formData.get("title"));
  if (!title.success) return;
  await db.update(s.modules).set({ title: title.data }).where(eq(s.modules.id, moduleId));
  await touch(course.id);
}

export async function moveModuleAction(moduleId: string, dir: "up" | "down"): Promise<void> {
  const { course } = await viaModule(moduleId);
  const siblings = await db.select({ id: s.modules.id }).from(s.modules).where(eq(s.modules.courseId, course.id)).orderBy(asc(s.modules.position));
  const order = swapped(siblings.map((m) => m.id), moduleId, dir);
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(s.modules).set({ position: i + 1 }).where(eq(s.modules.id, id));
  });
  await touch(course.id);
}

export async function deleteModuleAction(moduleId: string): Promise<void> {
  const { course } = await viaModule(moduleId);
  await db.transaction(async (tx) => {
    await tx.delete(s.modules).where(eq(s.modules.id, moduleId));
    const rest = await tx.select({ id: s.modules.id }).from(s.modules).where(eq(s.modules.courseId, course.id)).orderBy(asc(s.modules.position));
    for (const [i, m] of rest.entries()) await tx.update(s.modules).set({ position: i + 1 }).where(eq(s.modules.id, m.id));
  });
  await touch(course.id);
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function addLessonAction(moduleId: string): Promise<void> {
  const { course } = await viaModule(moduleId);
  const siblings = await db.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.moduleId, moduleId));
  const [lesson] = await db
    .insert(s.lessons)
    .values({ moduleId, courseId: course.id, title: "Untitled lesson", position: siblings.length + 1 })
    .returning({ id: s.lessons.id });
  await touch(course.id);
  redirect(`/instructor/courses/${course.id}/lessons/${lesson.id}`);
}

const lessonSchema = z
  .object({
    title: z.string().trim().min(1, "Give the lesson a title.").max(120),
    type: z.enum(["reading", "video"]),
    durationMin: z.coerce.number().int().min(1, "At least 1 minute.").max(240, "At most 240 minutes."),
    videoUrl: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^https?:\/\//i.test(v), "Use a full http(s) link.")
      .nullable(),
    content: z.string().max(50_000, "That's very long — split it into two lessons."),
  })
  .refine((d) => d.type !== "video" || d.videoUrl !== null, { path: ["videoUrl"], message: "Add the video link." });

export async function updateLessonAction(lessonId: string, _prev: EditorFormState, formData: FormData): Promise<EditorFormState> {
  const { course } = await viaLesson(lessonId);
  const parsed = lessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  await db.update(s.lessons).set(parsed.data).where(eq(s.lessons.id, lessonId));
  await touch(course.id);
  return { ok: true, savedAt: Date.now() };
}

export async function moveLessonAction(lessonId: string, dir: "up" | "down"): Promise<void> {
  const { course, moduleId } = await viaLesson(lessonId);
  const siblings = await db.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.moduleId, moduleId)).orderBy(asc(s.lessons.position));
  const order = swapped(siblings.map((l) => l.id), lessonId, dir);
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(s.lessons).set({ position: i + 1 }).where(eq(s.lessons.id, id));
  });
  await touch(course.id);
}

export async function deleteLessonAction(lessonId: string): Promise<void> {
  const { course, moduleId } = await viaLesson(lessonId);
  await db.transaction(async (tx) => {
    await tx.delete(s.lessons).where(eq(s.lessons.id, lessonId));
    const rest = await tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.moduleId, moduleId)).orderBy(asc(s.lessons.position));
    for (const [i, l] of rest.entries()) await tx.update(s.lessons).set({ position: i + 1 }).where(eq(s.lessons.id, l.id));
  });
  await touch(course.id);
}

// ---------------------------------------------------------------------------
// Quizzes & questions
// ---------------------------------------------------------------------------

export async function addQuizAction(moduleId: string): Promise<void> {
  const { course } = await viaModule(moduleId);
  const [mod] = await db.select({ title: s.modules.title }).from(s.modules).where(eq(s.modules.id, moduleId)).limit(1);
  const [existing] = await db.select({ id: s.quizzes.id }).from(s.quizzes).where(eq(s.quizzes.moduleId, moduleId)).limit(1);
  if (existing) redirect(`/instructor/courses/${course.id}/quizzes/${existing.id}`);

  const [quiz] = await db
    .insert(s.quizzes)
    .values({ moduleId, courseId: course.id, title: `${mod?.title ?? "Module"} quiz` })
    .returning({ id: s.quizzes.id });
  await touch(course.id);
  redirect(`/instructor/courses/${course.id}/quizzes/${quiz.id}`);
}

const quizSchema = z.object({
  title: z.string().trim().min(1, "Give the quiz a title.").max(120),
  passScore: z.coerce.number().int().min(1, "Between 1 and 100.").max(100, "Between 1 and 100."),
  escalateAfter: z.coerce.number().int().min(1, "Between 1 and 10.").max(10, "Between 1 and 10."),
});

export async function updateQuizAction(quizId: string, _prev: EditorFormState, formData: FormData): Promise<EditorFormState> {
  const { course } = await viaQuiz(quizId);
  const parsed = quizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  await db.update(s.quizzes).set(parsed.data).where(eq(s.quizzes.id, quizId));
  await touch(course.id);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteQuizAction(quizId: string): Promise<void> {
  const { course } = await viaQuiz(quizId);
  await db.delete(s.quizzes).where(eq(s.quizzes.id, quizId));
  await touch(course.id);
  redirect(`/instructor/courses/${course.id}/edit`);
}

const questionSchema = z.object({
  quizId: z.uuid(),
  questionId: z.uuid().optional(),
  prompt: z.string().trim().min(1, "Write the question.").max(500),
  type: z.enum(["single", "multiple", "true_false"]),
  explanation: z.string().trim().max(1000).default(""),
  lessonId: z.uuid().nullable(),
  options: z
    .array(z.object({ id: z.uuid().optional(), text: z.string().trim().min(1, "Options can't be empty.").max(200), isCorrect: z.boolean() }))
    .min(2, "Add at least two options.")
    .max(8, "Use at most eight options."),
});

export async function saveQuestionAction(
  input: z.input<typeof questionSchema>,
): Promise<{ ok: true; questionId: string } | { ok: false; error: string }> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the question." };
  const q = parsed.data;
  const { course, moduleId } = await viaQuiz(q.quizId);

  const correct = q.options.filter((o) => o.isCorrect).length;
  if (correct === 0) return { ok: false, error: "Mark at least one option as correct." };
  if (q.type !== "multiple" && correct !== 1) return { ok: false, error: "Choose exactly one correct answer." };
  if (q.type === "true_false") {
    const texts = q.options.map((o) => o.text).sort();
    if (q.options.length !== 2 || texts[0] !== "False" || texts[1] !== "True") {
      return { ok: false, error: "True/false questions use the options “True” and “False”." };
    }
  }

  if (q.lessonId) {
    const [lesson] = await db
      .select({ id: s.lessons.id })
      .from(s.lessons)
      .where(and(eq(s.lessons.id, q.lessonId), eq(s.lessons.moduleId, moduleId)))
      .limit(1);
    if (!lesson) return { ok: false, error: "Pick a lesson from this module." };
  }

  const questionId = await db.transaction(async (tx) => {
    let id = q.questionId;
    if (id) {
      // Must belong to this quiz — never trust a client-supplied id across quizzes.
      const [own] = await tx.select({ id: s.questions.id }).from(s.questions).where(and(eq(s.questions.id, id), eq(s.questions.quizId, q.quizId))).limit(1);
      if (!own) throw new Error("Question not found in this quiz.");
      await tx.update(s.questions).set({ prompt: q.prompt, type: q.type, explanation: q.explanation || null, lessonId: q.lessonId }).where(eq(s.questions.id, id));
    } else {
      const existing = await tx.select({ id: s.questions.id }).from(s.questions).where(eq(s.questions.quizId, q.quizId));
      const [row] = await tx
        .insert(s.questions)
        .values({ quizId: q.quizId, prompt: q.prompt, type: q.type, explanation: q.explanation || null, lessonId: q.lessonId, position: existing.length + 1 })
        .returning({ id: s.questions.id });
      id = row.id;
    }

    // Update options in place by id so past attempts keep pointing at real options.
    const current = await tx.select({ id: s.options.id }).from(s.options).where(eq(s.options.questionId, id));
    const currentIds = new Set(current.map((o) => o.id));
    const keep = new Set<string>();
    for (const [i, o] of q.options.entries()) {
      if (o.id && currentIds.has(o.id)) {
        keep.add(o.id);
        await tx.update(s.options).set({ text: o.text, isCorrect: o.isCorrect, position: i + 1 }).where(eq(s.options.id, o.id));
      } else {
        await tx.insert(s.options).values({ questionId: id, text: o.text, isCorrect: o.isCorrect, position: i + 1 });
      }
    }
    const removed = current.map((o) => o.id).filter((oid) => !keep.has(oid));
    if (removed.length > 0) await tx.delete(s.options).where(inArray(s.options.id, removed));
    return id;
  });

  await touch(course.id);
  return { ok: true, questionId };
}

export async function deleteQuestionAction(questionId: string): Promise<void> {
  const { course, quizId } = await viaQuestion(questionId);
  await db.transaction(async (tx) => {
    await tx.delete(s.questions).where(eq(s.questions.id, questionId));
    const rest = await tx.select({ id: s.questions.id }).from(s.questions).where(eq(s.questions.quizId, quizId)).orderBy(asc(s.questions.position));
    for (const [i, r] of rest.entries()) await tx.update(s.questions).set({ position: i + 1 }).where(eq(s.questions.id, r.id));
  });
  await touch(course.id);
}

export async function moveQuestionAction(questionId: string, dir: "up" | "down"): Promise<void> {
  const { course, quizId } = await viaQuestion(questionId);
  const siblings = await db.select({ id: s.questions.id }).from(s.questions).where(eq(s.questions.quizId, quizId)).orderBy(asc(s.questions.position));
  const order = swapped(siblings.map((r) => r.id), questionId, dir);
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(s.questions).set({ position: i + 1 }).where(eq(s.questions.id, id));
  });
  await touch(course.id);
}
