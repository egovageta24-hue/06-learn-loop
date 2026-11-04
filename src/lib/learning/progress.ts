import type { CourseStructure, EnrollmentState, ModuleNode } from "./types";

export type ModuleStatus = "locked" | "available" | "complete";

export interface ModuleProgress {
  moduleId: string;
  lessonsDone: number;
  lessonsTotal: number;
  quizPassed: boolean;
  hasQuiz: boolean;
  status: ModuleStatus;
}

export interface CourseProgress {
  /** lessons + quizzes in the course */
  totalUnits: number;
  doneUnits: number;
  /** whole percent 0–100 */
  percent: number;
  modules: ModuleProgress[];
  isComplete: boolean;
}

export const sortedModules = (structure: CourseStructure): ModuleNode[] =>
  [...structure.modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.position - b.position) }));

export function isModuleDone(module: ModuleNode, state: EnrollmentState): boolean {
  const done = new Set(state.completedLessonIds);
  const lessonsDone = module.lessons.every((l) => done.has(l.id));
  const quizOk = module.quiz === null || state.passedQuizIds.includes(module.quiz.id);
  return lessonsDone && quizOk;
}

/**
 * Single source of truth for progress. Both the learner dashboard and the
 * instructor views call this with the same persisted facts, so the numbers
 * cannot drift apart.
 */
export function computeProgress(structure: CourseStructure, state: EnrollmentState): CourseProgress {
  const done = new Set(state.completedLessonIds);
  const passed = new Set(state.passedQuizIds);
  const modules = sortedModules(structure);

  let totalUnits = 0;
  let doneUnits = 0;
  let previousDone = true;

  const perModule: ModuleProgress[] = modules.map((m) => {
    const lessonsDone = m.lessons.filter((l) => done.has(l.id)).length;
    const quizPassed = m.quiz !== null && passed.has(m.quiz.id);
    totalUnits += m.lessons.length + (m.quiz ? 1 : 0);
    doneUnits += lessonsDone + (quizPassed ? 1 : 0);

    const complete = isModuleDone(m, state);
    const status: ModuleStatus = complete ? "complete" : previousDone ? "available" : "locked";
    previousDone = previousDone && complete;

    return {
      moduleId: m.id,
      lessonsDone,
      lessonsTotal: m.lessons.length,
      quizPassed,
      hasQuiz: m.quiz !== null,
      status,
    };
  });

  return {
    totalUnits,
    doneUnits,
    percent: totalUnits === 0 ? 0 : Math.floor((doneUnits * 100) / totalUnits),
    modules: perModule,
    isComplete: totalUnits > 0 && doneUnits === totalUnits,
  };
}
