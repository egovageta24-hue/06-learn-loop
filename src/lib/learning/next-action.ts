import { sortedModules } from "./progress";
import type { CourseStructure, EnrollmentState } from "./types";

export type NextAction =
  | { type: "start_lesson"; label: string; href: string; lessonId: string }
  | { type: "resume_lesson"; label: string; href: string; lessonId: string }
  | { type: "take_quiz"; label: string; href: string; quizId: string }
  | { type: "resume_quiz"; label: string; href: string; quizId: string; attemptId: string }
  | {
      type: "review_remediation";
      label: string;
      href: string;
      quizId: string;
      remediationId: string;
      remaining: number;
    }
  | { type: "retake_quiz"; label: string; href: string; quizId: string; escalated: boolean }
  | { type: "course_complete"; label: string; href: string }
  | { type: "no_content"; label: string; href: string };

const base = (slug: string) => `/learn/${slug}`;
const lessonHref = (slug: string, lessonId: string) => `${base(slug)}/lessons/${lessonId}`;
const quizHref = (slug: string, quizId: string) => `${base(slug)}/quizzes/${quizId}`;
const attemptHref = (slug: string, quizId: string, attemptId: string) =>
  `${quizHref(slug, quizId)}/attempts/${attemptId}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The one answer to "what should this learner do next?" for a course.
 *
 * Path rules: modules are sequential; inside a module all lessons come first,
 * then the module quiz. A module is finished when every lesson is complete and
 * its quiz (if any) is passed. We return the action for the first unfinished
 * module, so the result is always defined — a learner is never stuck.
 */
export function getNextAction(structure: CourseStructure, state: EnrollmentState): NextAction {
  const slug = structure.slug;
  const completed = new Set(state.completedLessonIds);
  const passed = new Set(state.passedQuizIds);
  const modules = sortedModules(structure);

  const hasContent = modules.some((m) => m.lessons.length > 0 || m.quiz);
  if (!hasContent) {
    return { type: "no_content", label: "Course content is coming soon", href: "/dashboard" };
  }

  for (const mod of modules) {
    const nextLesson = mod.lessons.find((l) => !completed.has(l.id));

    if (nextLesson) {
      // Prefer the lesson the learner was last on, if it's still unfinished in this module.
      const resumeTarget = mod.lessons.find(
        (l) => l.id === state.lastLessonId && !completed.has(l.id),
      );
      if (resumeTarget) {
        return {
          type: "resume_lesson",
          label: `Resume: ${resumeTarget.title}`,
          href: lessonHref(slug, resumeTarget.id),
          lessonId: resumeTarget.id,
        };
      }
      return {
        type: "start_lesson",
        label: `Start: ${nextLesson.title}`,
        href: lessonHref(slug, nextLesson.id),
        lessonId: nextLesson.id,
      };
    }

    const quiz = mod.quiz;
    if (!quiz || passed.has(quiz.id)) continue; // module finished → look at the next one

    const attemptId = state.inProgressAttempts[quiz.id];
    if (attemptId) {
      return {
        type: "resume_quiz",
        label: "Resume your quiz",
        href: quizHref(slug, quiz.id),
        quizId: quiz.id,
        attemptId,
      };
    }

    const remediation = state.openRemediation[quiz.id];
    if (remediation) {
      const remaining = remediation.items.filter((i) => !i.completed).length;
      if (remediation.status === "required" && remaining > 0) {
        return {
          type: "review_remediation",
          label: `Review ${plural(remaining, "lesson")} before retaking`,
          href: attemptHref(slug, quiz.id, remediation.attemptId),
          quizId: quiz.id,
          remediationId: remediation.id,
          remaining,
        };
      }
      return {
        type: "retake_quiz",
        label: remediation.status === "escalated" ? "Try the quiz again" : "Retake the quiz",
        href: quizHref(slug, quiz.id),
        quizId: quiz.id,
        escalated: remediation.status === "escalated",
      };
    }

    return {
      type: "take_quiz",
      label: "Take the module quiz",
      href: quizHref(slug, quiz.id),
      quizId: quiz.id,
    };
  }

  return { type: "course_complete", label: "Course complete — view your progress", href: "/progress" };
}
