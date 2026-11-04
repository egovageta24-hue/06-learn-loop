import type { OpenRemediationStatus } from "./types";
import { hasPassed } from "./scoring";

export interface SubmitDecisionInput {
  correctCount: number;
  totalCount: number;
  passScore: number;
  escalateAfter: number;
  /** Submitted-and-failed attempts for this enrollment+quiz BEFORE the one being decided. */
  priorFailedCount: number;
  /** One entry per wrong question, in question order. lessonId is the lesson that teaches it, if linked. */
  missedQuestions: { questionId: string; lessonId: string | null }[];
  /** Fallback review set when no missed question is linked to a lesson. */
  moduleLessonIds: string[];
  /** The remediation record currently open for this enrollment+quiz, if any. */
  openRemediationId: string | null;
}

export interface SubmitDecision {
  passed: boolean;
  /** Failed attempts including this one (unchanged on a pass). */
  failedCount: number;
  /** What to do with the previously open record. */
  closeOpen: { id: string; as: "resolved" | "superseded" } | null;
  /** New record to insert on a failure. */
  create: { status: OpenRemediationStatus; lessonIds: string[] } | null;
}

/**
 * Pure decision for what happens after a quiz is scored.
 *
 * No-loop guarantees:
 *  - a pass always resolves any open record and creates nothing;
 *  - a fail always supersedes the old open record, so there is at most one;
 *  - a record with nothing to review starts as `ready`, never `required`;
 *  - from `escalateAfter` failures onward the record is `escalated`, which
 *    lifts the review gate so the learner can always retry.
 */
export function decideAfterSubmit(input: SubmitDecisionInput): SubmitDecision {
  const passed = hasPassed(input.correctCount, input.totalCount, input.passScore);

  if (passed) {
    return {
      passed: true,
      failedCount: input.priorFailedCount,
      closeOpen: input.openRemediationId ? { id: input.openRemediationId, as: "resolved" } : null,
      create: null,
    };
  }

  const failedCount = input.priorFailedCount + 1;

  const linked = [
    ...new Set(
      input.missedQuestions.map((q) => q.lessonId).filter((id): id is string => id !== null),
    ),
  ];
  const lessonIds = linked.length > 0 ? linked : [...new Set(input.moduleLessonIds)];

  const status: OpenRemediationStatus =
    failedCount >= input.escalateAfter ? "escalated" : lessonIds.length === 0 ? "ready" : "required";

  return {
    passed: false,
    failedCount,
    closeOpen: input.openRemediationId ? { id: input.openRemediationId, as: "superseded" } : null,
    create: { status, lessonIds },
  };
}

/** After a review item is ticked off: `required` becomes `ready` once every item is done. */
export function statusAfterItemReviewed(
  status: OpenRemediationStatus,
  items: { completed: boolean }[],
): OpenRemediationStatus {
  if (status !== "required") return status;
  return items.every((i) => i.completed) ? "ready" : "required";
}

/** Retake is blocked only while a `required` record still has unreviewed items. */
export function canStartAttempt(
  remediation: { status: OpenRemediationStatus; items: { completed: boolean }[] } | null,
): boolean {
  if (!remediation) return true;
  if (remediation.status !== "required") return true;
  return remediation.items.every((i) => i.completed);
}
