/**
 * Database-backed checks for the guarantees in the acceptance criteria:
 *   - quiz attempts are stored correctly (and scored exactly once)
 *   - remediation never loops or duplicates
 *
 * Needs a real Postgres (Neon) reachable via DATABASE_URL in .env.local, with the
 * schema pushed (`npm run db:push`). Skipped automatically when it isn't set.
 * Each run creates its own throwaway organisation and deletes it afterwards.
 */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("scoreAndRecordAttempt (integration)", () => {
  // Loaded lazily so DATABASE_URL is in place before the pool is created.
  let dbm: typeof import("../../src/db");
  let s: typeof import("../../src/db/schema");
  let submit: typeof import("../../src/lib/learning/submit-attempt");

  let orgId: string;
  let enrollmentId: string;
  let quizId: string;
  let moduleId: string;
  let lessonIds: string[];
  let questions: { id: string; lessonId: string; correct: string; wrong: string }[];

  beforeAll(async () => {
    dbm = await import("../../src/db");
    s = await import("../../src/db/schema");
    submit = await import("../../src/lib/learning/submit-attempt");
    const { db } = dbm;

    const tag = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [org] = await db.insert(s.organizations).values({ name: tag, slug: tag }).returning();
    orgId = org.id;

    const [instructor, learner] = await db
      .insert(s.users)
      .values([
        { orgId, name: "Test Instructor", email: `${tag}-i@test.local`, passwordHash: "x", role: "instructor" },
        { orgId, name: "Test Learner", email: `${tag}-l@test.local`, passwordHash: "x", role: "learner" },
      ])
      .returning();

    const [course] = await db
      .insert(s.courses)
      .values({ orgId, instructorId: instructor.id, slug: tag, title: "Integration course", status: "published" })
      .returning();
    const [mod] = await db.insert(s.modules).values({ courseId: course.id, title: "M1", position: 1 }).returning();
    moduleId = mod.id;

    const lessons = await db
      .insert(s.lessons)
      .values([
        { moduleId, courseId: course.id, title: "L1", position: 1 },
        { moduleId, courseId: course.id, title: "L2", position: 2 },
      ])
      .returning();
    lessonIds = lessons.sort((a, b) => a.position - b.position).map((l) => l.id);

    const [quiz] = await db
      .insert(s.quizzes)
      .values({ moduleId, courseId: course.id, title: "Quiz", passScore: 50, escalateAfter: 3 })
      .returning();
    quizId = quiz.id;

    questions = [];
    for (const [i, lessonId] of lessonIds.entries()) {
      const [q] = await db
        .insert(s.questions)
        .values({ quizId, prompt: `Q${i + 1}`, lessonId, position: i + 1 })
        .returning();
      const [right, wrong] = await db
        .insert(s.options)
        .values([
          { questionId: q.id, text: "right", isCorrect: true, position: 1 },
          { questionId: q.id, text: "wrong", isCorrect: false, position: 2 },
        ])
        .returning();
      questions.push({ id: q.id, lessonId, correct: right.id, wrong: wrong.id });
    }

    const [enrollment] = await db.insert(s.enrollments).values({ userId: learner.id, courseId: course.id }).returning();
    enrollmentId = enrollment.id;
  });

  afterAll(async () => {
    if (!dbm) return;
    // Everything hangs off the organisation, so one delete cascades the fixture away.
    await dbm.db.delete(s.organizations).where(eq(s.organizations.id, orgId));
    await dbm.pool.end();
  });

  /** Starts an attempt and saves answers: `right` questions correct (first N), the rest wrong. */
  async function startAttempt(right: number) {
    const { db } = dbm;
    const prior = await db
      .select({ n: s.attempts.attemptNo })
      .from(s.attempts)
      .where(and(eq(s.attempts.enrollmentId, enrollmentId), eq(s.attempts.quizId, quizId)));
    const [attempt] = await db
      .insert(s.attempts)
      .values({ enrollmentId, quizId, attemptNo: prior.length + 1 })
      .returning();
    await db.insert(s.answers).values(
      questions.map((q, i) => ({
        attemptId: attempt.id,
        questionId: q.id,
        selectedOptionIds: [i < right ? q.correct : q.wrong],
      })),
    );
    return attempt.id;
  }

  const ref = (attemptId: string) => ({ attemptId, enrollmentId, quizId, moduleId });

  async function openRecords() {
    return dbm.db
      .select()
      .from(s.remediationRecords)
      .where(and(eq(s.remediationRecords.enrollmentId, enrollmentId), eq(s.remediationRecords.quizId, quizId)));
  }

  it("scores a duplicate/concurrent submit exactly once", async () => {
    const attemptId = await startAttempt(0); // 0/2 → fail

    const [a, b] = await Promise.all([
      submit.scoreAndRecordAttempt(ref(attemptId)),
      submit.scoreAndRecordAttempt(ref(attemptId)),
    ]);

    expect([a.scored, b.scored].sort()).toEqual([false, true]);

    const [row] = await dbm.db.select().from(s.attempts).where(eq(s.attempts.id, attemptId));
    expect(row).toMatchObject({ status: "submitted", score: 0, correctCount: 0, totalCount: 2, passed: false });

    const answers = await dbm.db.select().from(s.answers).where(eq(s.answers.attemptId, attemptId));
    expect(answers).toHaveLength(2);
    expect(answers.every((x) => x.isCorrect === false)).toBe(true);

    // One failed attempt → exactly one remediation record, with both linked lessons to review.
    const records = (await openRecords()).filter((r) => r.attemptId === attemptId);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("required");
    const items = await dbm.db.select().from(s.remediationItems).where(eq(s.remediationItems.remediationId, records[0].id));
    expect(items.map((i) => i.lessonId).sort()).toEqual([...lessonIds].sort());
  });

  it("a repeat failure supersedes the old record, leaving exactly one open", async () => {
    const second = await startAttempt(0);
    await submit.scoreAndRecordAttempt(ref(second));

    const records = await openRecords();
    const open = records.filter((r) => ["required", "ready", "escalated"].includes(r.status));
    expect(open).toHaveLength(1);
    expect(open[0].attemptId).toBe(second);
    expect(records.filter((r) => r.status === "superseded")).toHaveLength(1);
  });

  it("escalates on the third failure instead of looping", async () => {
    const third = await startAttempt(0);
    await submit.scoreAndRecordAttempt(ref(third));

    const open = (await openRecords()).filter((r) => ["required", "ready", "escalated"].includes(r.status));
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ attemptId: third, status: "escalated" });
  });

  it("a pass resolves the open record and creates no new one", async () => {
    const before = (await openRecords()).length;
    const passing = await startAttempt(2); // 2/2

    const outcome = await submit.scoreAndRecordAttempt(ref(passing));
    expect(outcome).toMatchObject({ scored: true, score: 100, passed: true });

    const records = await openRecords();
    expect(records).toHaveLength(before); // nothing added
    expect(records.filter((r) => ["required", "ready", "escalated"].includes(r.status))).toHaveLength(0);
    const resolved = records.filter((r) => r.status === "resolved");
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolvedByAttemptId).toBe(passing);
  });

  it("the database refuses a second in-progress attempt for the same learner and quiz", async () => {
    await startAttempt(0); // leaves one in progress
    await expect(
      dbm.db.insert(s.attempts).values({ enrollmentId, quizId, attemptNo: 999 }),
    ).rejects.toThrow();
  });
});
