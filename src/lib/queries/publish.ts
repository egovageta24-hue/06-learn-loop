import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

/**
 * Everything that must be true before learners can see a course. Returns
 * human-readable problems (empty = publishable). Shared by the instructor
 * editor and the admin console so both enforce the same bar.
 */
export async function validateCourseForPublish(courseId: string): Promise<string[]> {
  const problems: string[] = [];

  const [course] = await db.select().from(s.courses).where(eq(s.courses.id, courseId)).limit(1);
  if (!course) return ["Course not found."];
  if (!course.title.trim()) problems.push("Give the course a title.");
  if (!course.summary.trim()) problems.push("Add a one-line summary so learners know what the course is about.");

  const modules = await db.select().from(s.modules).where(eq(s.modules.courseId, courseId)).orderBy(asc(s.modules.position));
  if (modules.length === 0) return [...problems, "Add at least one module."];

  const [lessons, quizzes] = await Promise.all([
    db.select({ id: s.lessons.id, moduleId: s.lessons.moduleId }).from(s.lessons).where(eq(s.lessons.courseId, courseId)),
    db.select().from(s.quizzes).where(eq(s.quizzes.courseId, courseId)),
  ]);

  modules.forEach((m, i) => {
    if (!lessons.some((l) => l.moduleId === m.id)) problems.push(`Module ${i + 1} (“${m.title}”) needs at least one lesson.`);
  });

  if (quizzes.length > 0) {
    const questions = await db
      .select()
      .from(s.questions)
      .where(inArray(s.questions.quizId, quizzes.map((q) => q.id)))
      .orderBy(asc(s.questions.position));
    const options = questions.length
      ? await db.select().from(s.options).where(inArray(s.options.questionId, questions.map((q) => q.id)))
      : [];

    for (const quiz of quizzes) {
      const qs = questions.filter((q) => q.quizId === quiz.id);
      if (qs.length === 0) problems.push(`“${quiz.title}” has no questions.`);
      qs.forEach((q, i) => {
        const opts = options.filter((o) => o.questionId === q.id);
        const correct = opts.filter((o) => o.isCorrect).length;
        const where = `“${quiz.title}” question ${i + 1}`;
        if (opts.length < 2) problems.push(`${where} needs at least two options.`);
        else if (correct === 0) problems.push(`${where} has no correct answer marked.`);
        else if (q.type !== "multiple" && correct !== 1) problems.push(`${where} must have exactly one correct answer.`);
      });
    }
  }

  return problems;
}
