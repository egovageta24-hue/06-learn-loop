/**
 * Plain-data shapes shared by the pure learning-domain modules.
 * Everything here is serialisable (no Sets/Maps) so it can cross the
 * server → client boundary unchanged.
 */

export interface LessonNode {
  id: string;
  title: string;
  position: number;
}

export interface QuizNode {
  id: string;
  passScore: number;
  escalateAfter: number;
}

export interface ModuleNode {
  id: string;
  title: string;
  position: number;
  lessons: LessonNode[];
  quiz: QuizNode | null;
}

export interface CourseStructure {
  slug: string;
  modules: ModuleNode[];
}

export type OpenRemediationStatus = "required" | "ready" | "escalated";

/** Remediation states that count as "open" (the partial unique index allows only one per enrollment+quiz). */
export const OPEN_REMEDIATION = ["required", "ready", "escalated"] as const;

export interface OpenRemediation {
  id: string;
  /** The failed attempt that produced this record; its results page lists the review items. */
  attemptId: string;
  status: OpenRemediationStatus;
  items: { lessonId: string; completed: boolean }[];
}

/** Everything we know about one learner's journey through one course. */
export interface EnrollmentState {
  completedLessonIds: string[];
  passedQuizIds: string[];
  /** quizId → attemptId of the attempt that is currently in progress. */
  inProgressAttempts: Record<string, string>;
  /** quizId → the single open (unresolved, unsuperseded) remediation record. */
  openRemediation: Record<string, OpenRemediation>;
  lastLessonId: string | null;
}

export const emptyEnrollmentState = (): EnrollmentState => ({
  completedLessonIds: [],
  passedQuizIds: [],
  inProgressAttempts: {},
  openRemediation: {},
  lastLessonId: null,
});
