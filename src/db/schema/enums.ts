import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["learner", "instructor", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);

export const courseStatus = pgEnum("course_status", ["draft", "published", "archived"]);
export const courseLevel = pgEnum("course_level", ["beginner", "intermediate", "advanced"]);
export const lessonType = pgEnum("lesson_type", ["reading", "video"]);
export const questionType = pgEnum("question_type", ["single", "multiple", "true_false"]);

export const enrollmentStatus = pgEnum("enrollment_status", ["active", "completed", "dropped"]);
export const progressStatus = pgEnum("progress_status", ["in_progress", "completed"]);
export const attemptStatus = pgEnum("attempt_status", ["in_progress", "submitted"]);
export const noteKind = pgEnum("note_kind", ["note", "bookmark"]);
export const remediationStatus = pgEnum("remediation_status", [
  "required",
  "ready",
  "resolved",
  "superseded",
  "escalated",
]);
