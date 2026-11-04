import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./accounts";
import { courseLevel, courseStatus, lessonType, questionType } from "./enums";

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    level: courseLevel("level").notNull().default("beginner"),
    /** Key into the deterministic SVG cover palette, e.g. "violet", "sky", "amber". */
    coverTheme: text("cover_theme").notNull().default("violet"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(60),
    status: courseStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("courses_org_status_idx").on(t.orgId, t.status),
    index("courses_instructor_idx").on(t.instructorId),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("modules_course_idx").on(t.courseId, t.position)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    /** Denormalised so progress queries don't have to join through modules. */
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: lessonType("type").notNull().default("reading"),
    /** Markdown body. */
    content: text("content").notNull().default(""),
    videoUrl: text("video_url"),
    durationMin: integer("duration_min").notNull().default(5),
    position: integer("position").notNull(),
  },
  (t) => [index("lessons_module_idx").on(t.moduleId, t.position), index("lessons_course_idx").on(t.courseId)],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** One quiz per module; it gates the next module. */
    moduleId: uuid("module_id")
      .notNull()
      .unique()
      .references(() => modules.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    passScore: integer("pass_score").notNull().default(70),
    /** Failed attempts after which the remediation review gate is lifted. */
    escalateAfter: integer("escalate_after").notNull().default(3),
  },
  (t) => [index("quizzes_course_idx").on(t.courseId)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: questionType("type").notNull().default("single"),
    explanation: text("explanation"),
    /** The lesson that teaches this; drives targeted remediation. */
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId, t.position)],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [index("options_question_idx").on(t.questionId, t.position)],
);
