import type { OpenRemediationStatus } from "./types";

export const INACTIVE_DAYS = 14;

export type LearnerStatus =
  | "completed"
  | "escalated"
  | "inactive"
  | "review_required"
  | "not_started"
  | "on_track";

const DAY_MS = 86_400_000;

/**
 * One definition of a learner's standing, shared by every instructor view so
 * the dashboard, roster and at-risk list can never disagree.
 *
 * Precedence: finished work wins; then "escalated" (several failed attempts);
 * then "inactive" (no activity for INACTIVE_DAYS); then a pending review.
 */
export function learnerStatus(input: {
  complete: boolean;
  doneUnits: number;
  lastActivityAt: Date;
  now: Date;
  openRemediation: OpenRemediationStatus[];
}): LearnerStatus {
  if (input.complete) return "completed";
  if (input.openRemediation.includes("escalated")) return "escalated";
  const idleDays = (input.now.getTime() - input.lastActivityAt.getTime()) / DAY_MS;
  if (idleDays >= INACTIVE_DAYS) return "inactive";
  if (input.openRemediation.includes("required")) return "review_required";
  if (input.doneUnits === 0) return "not_started";
  return "on_track";
}

/** Statuses that should prompt an instructor to reach out. */
export const isAtRisk = (status: LearnerStatus): boolean => status === "escalated" || status === "inactive";

export const statusLabel: Record<LearnerStatus, string> = {
  completed: "Completed",
  escalated: "Needs help",
  inactive: "Inactive",
  review_required: "Reviewing",
  not_started: "Not started",
  on_track: "On track",
};
