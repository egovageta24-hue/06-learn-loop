import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./accounts";
import { courses, lessons, questions, quizzes } from "./courses";
import {
  attemptStatus,
  enrollmentStatus,
  noteKind,
  progressStatus,
  remediationStatus,
} from "./enums";

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Resume pointer: the last lesson the learner opened. */
    lastLessonId: uuid("last_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("enrollments_user_course_uq").on(t.userId, t.courseId), index("enrollments_course_idx").on(t.courseId)],
);

/** One row per (enrollment, lesson) once the learner has opened it. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: progressStatus("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastPositionSec: integer("last_position_sec").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("lesson_progress_enrollment_lesson_uq").on(t.enrollmentId, t.lessonId)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    status: attemptStatus("status").notNull().default("in_progress"),
    /** Whole percent, floored. Null until submitted. */
    score: integer("score"),
    correctCount: integer("correct_count"),
    totalCount: integer("total_count"),
    passed: boolean("passed"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    unique("attempts_enrollment_quiz_no_uq").on(t.enrollmentId, t.quizId, t.attemptNo),
    // At most one attempt in progress per learner+quiz → refresh resumes it, double-start can't fork it.
    uniqueIndex("attempts_one_in_progress_uq")
      .on(t.enrollmentId, t.quizId)
      .where(sql`${t.status} = 'in_progress'`),
    index("attempts_quiz_idx").on(t.quizId),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    // Not FK-enforced (Postgres can't FK array elements); the submit action validates every id belongs to the question.
    selectedOptionIds: uuid("selected_option_ids").array().notNull().default(sql`'{}'::uuid[]`),
    /** Null while the attempt is in progress; set once at submit. */
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("answers_attempt_question_uq").on(t.attemptId, t.questionId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    kind: noteKind("kind").notNull().default("note"),
    body: text("body"),
    positionSec: integer("position_sec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_lesson_idx").on(t.userId, t.lessonId)],
);

export const remediationRecords = pgTable(
  "remediation_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    /** The failed attempt that produced this record. One record per failed attempt. */
    attemptId: uuid("attempt_id")
      .notNull()
      .unique()
      .references(() => attempts.id, { onDelete: "cascade" }),
    status: remediationStatus("status").notNull().default("required"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** The passing attempt that closed this record, if any. */
    resolvedByAttemptId: uuid("resolved_by_attempt_id").references(() => attempts.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // At most one open record per learner+quiz — a new failure supersedes the old one.
    uniqueIndex("remediation_one_open_uq")
      .on(t.enrollmentId, t.quizId)
      .where(sql`${t.status} in ('required', 'ready', 'escalated')`),
  ],
);

export const remediationItems = pgTable(
  "remediation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    remediationId: uuid("remediation_id")
      .notNull()
      .references(() => remediationRecords.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique("remediation_items_record_lesson_uq").on(t.remediationId, t.lessonId)],
);
