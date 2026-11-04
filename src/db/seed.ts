/**
 * Seeds a demo organisation, courses and learner histories covering every
 * learning state (resume, passed, remediation required/ready/escalated,
 * stalled, in-progress quiz, completed).
 *
 *   npm run db:seed        (reads DATABASE_URL from .env.local)
 *
 * DESTRUCTIVE: wipes every table first. Refuses to run with NODE_ENV=production.
 */
import bcrypt from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { decideAfterSubmit, statusAfterItemReviewed } from "../lib/learning/remediation";
import { scoreAttempt } from "../lib/learning/scoring";
import { db } from "./index";
import * as s from "./schema";
import { seedCourses } from "./seed-data";

export const DEMO_PASSWORD = "learnloop123";

const HOUR = 3_600_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * HOUR);

type QuestionRec = {
  id: string;
  lessonId: string;
  correctOptionIds: string[];
  wrongOptionId: string;
};
type QuizRec = {
  id: string;
  passScore: number;
  escalateAfter: number;
  lessonIds: string[];
  questions: QuestionRec[];
};
type ModuleRec = { id: string; lessonIds: string[]; quiz: QuizRec };
type CourseRec = { id: string; slug: string; modules: ModuleRec[] };

async function createUsers(orgId: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const rows = [
    { key: "admin", name: "Sam Rivera", email: "admin@learnloop.test", role: "admin" },
    { key: "maya", name: "Maya Brooks", email: "maya@learnloop.test", role: "instructor" },
    { key: "jonas", name: "Jonas Weber", email: "jonas@learnloop.test", role: "instructor" },
    { key: "ava", name: "Ava Chen", email: "ava@learnloop.test", role: "learner" },
    { key: "ben", name: "Ben Okafor", email: "ben@learnloop.test", role: "learner" },
    { key: "chloe", name: "Chloe Martin", email: "chloe@learnloop.test", role: "learner" },
    { key: "dev", name: "Dev Patel", email: "dev@learnloop.test", role: "learner" },
    { key: "elena", name: "Elena Rossi", email: "elena@learnloop.test", role: "learner" },
    { key: "farid", name: "Farid Haddad", email: "farid@learnloop.test", role: "learner" },
    { key: "grace", name: "Grace Kim", email: "grace@learnloop.test", role: "learner" },
    { key: "hugo", name: "Hugo Silva", email: "hugo@learnloop.test", role: "learner" },
    { key: "iris", name: "Iris Novak", email: "iris@learnloop.test", role: "learner", status: "suspended" },
  ] as const;

  const inserted = await db
    .insert(s.users)
    .values(
      rows.map((r) => ({
        orgId,
        name: r.name,
        email: r.email,
        role: r.role,
        status: "status" in r ? r.status : ("active" as const),
        passwordHash,
      })),
    )
    .returning({ id: s.users.id, email: s.users.email });

  const byEmail = new Map(inserted.map((u) => [u.email, u.id]));
  return Object.fromEntries(rows.map((r) => [r.key, byEmail.get(r.email)!])) as Record<
    (typeof rows)[number]["key"],
    string
  >;
}

async function createCourses(orgId: string, instructors: Record<"maya" | "jonas", string>) {
  const recs: Record<string, CourseRec> = {};

  for (const c of seedCourses) {
    const [course] = await db
      .insert(s.courses)
      .values({
        orgId,
        instructorId: instructors[c.instructor],
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        description: c.description,
        category: c.category,
        level: c.level,
        coverTheme: c.coverTheme,
        status: c.status,
        estimatedMinutes: c.modules.flatMap((m) => m.lessons).reduce((sum, l) => sum + l.minutes, 0),
        createdAt: ago(40),
      })
      .returning({ id: s.courses.id });

    const moduleRecs: ModuleRec[] = [];

    for (const [mi, m] of c.modules.entries()) {
      const [mod] = await db
        .insert(s.modules)
        .values({ courseId: course.id, title: m.title, position: mi + 1 })
        .returning({ id: s.modules.id });

      const lessonRows = await db
        .insert(s.lessons)
        .values(
          m.lessons.map((l, li) => ({
            moduleId: mod.id,
            courseId: course.id,
            title: l.title,
            type: l.type ?? ("reading" as const),
            content: l.content,
            videoUrl: l.videoUrl ?? null,
            durationMin: l.minutes,
            position: li + 1,
          })),
        )
        .returning({ id: s.lessons.id, position: s.lessons.position });
      const lessonIds = lessonRows.sort((a, b) => a.position - b.position).map((l) => l.id);

      const [quiz] = await db
        .insert(s.quizzes)
        .values({ moduleId: mod.id, courseId: course.id, title: m.quiz.title })
        .returning({ id: s.quizzes.id, passScore: s.quizzes.passScore, escalateAfter: s.quizzes.escalateAfter });

      const questions: QuestionRec[] = [];
      for (const [qi, q] of m.quiz.questions.entries()) {
        const [question] = await db
          .insert(s.questions)
          .values({
            quizId: quiz.id,
            prompt: q.prompt,
            type: q.type,
            explanation: q.explanation,
            lessonId: lessonIds[q.lesson],
            position: qi + 1,
          })
          .returning({ id: s.questions.id });

        const optionRows = await db
          .insert(s.options)
          .values(q.options.map((o, oi) => ({ questionId: question.id, text: o.text, isCorrect: o.correct, position: oi + 1 })))
          .returning({ id: s.options.id, isCorrect: s.options.isCorrect });

        questions.push({
          id: question.id,
          lessonId: lessonIds[q.lesson],
          correctOptionIds: optionRows.filter((o) => o.isCorrect).map((o) => o.id),
          wrongOptionId: optionRows.find((o) => !o.isCorrect)!.id,
        });
      }

      moduleRecs.push({
        id: mod.id,
        lessonIds,
        quiz: { id: quiz.id, passScore: quiz.passScore, escalateAfter: quiz.escalateAfter, lessonIds, questions },
      });
    }

    recs[c.slug] = { id: course.id, slug: c.slug, modules: moduleRecs };
  }
  return recs;
}

// ---------------------------------------------------------------------------
// Learner-history helpers. Attempts go through the real scoring + remediation
// decision code so seeded data is consistent with what the app will produce.
// ---------------------------------------------------------------------------

async function enroll(userId: string, course: CourseRec, enrolledAt: Date) {
  const [e] = await db
    .insert(s.enrollments)
    .values({ userId, courseId: course.id, enrolledAt, lastActivityAt: enrolledAt })
    .returning({ id: s.enrollments.id });
  return e.id;
}

async function touch(enrollmentId: string, when: Date, lastLessonId?: string) {
  await db
    .update(s.enrollments)
    .set({ lastActivityAt: when, ...(lastLessonId ? { lastLessonId } : {}) })
    .where(eq(s.enrollments.id, enrollmentId));
}

/** Marks lessons complete, one per `stepHours`, starting `startDaysAgo` days back. */
async function completeLessons(enrollmentId: string, lessonIds: string[], startDaysAgo: number, stepHours = 6) {
  let lastWhen = ago(startDaysAgo);
  for (const [i, lessonId] of lessonIds.entries()) {
    lastWhen = new Date(ago(startDaysAgo).getTime() + i * stepHours * HOUR);
    await db.insert(s.lessonProgress).values({
      enrollmentId,
      lessonId,
      status: "completed",
      completedAt: lastWhen,
      updatedAt: lastWhen,
    });
  }
  await touch(enrollmentId, lastWhen, lessonIds[lessonIds.length - 1]);
}

async function openLesson(enrollmentId: string, lessonId: string, when: Date) {
  await db.insert(s.lessonProgress).values({ enrollmentId, lessonId, status: "in_progress", updatedAt: when });
  await touch(enrollmentId, when, lessonId);
}

/** Submits a scored attempt where the first `correct` questions are answered right. */
async function submitAttempt(
  enrollmentId: string,
  quiz: QuizRec,
  correct: number,
  when: Date,
  opts: { reviewAll?: boolean } = {},
) {
  const prior = await db
    .select()
    .from(s.attempts)
    .where(and(eq(s.attempts.enrollmentId, enrollmentId), eq(s.attempts.quizId, quiz.id)));
  const attemptNo = prior.length + 1;
  const priorFailedCount = prior.filter((a) => a.status === "submitted" && a.passed === false).length;

  const picks: Record<string, string[]> = {};
  quiz.questions.forEach((q, i) => {
    picks[q.id] = i < correct ? q.correctOptionIds : [q.wrongOptionId];
  });
  const graded = scoreAttempt(
    quiz.questions.map((q) => ({ id: q.id, correctOptionIds: q.correctOptionIds })),
    picks,
  );

  const [open] = await db
    .select({ id: s.remediationRecords.id })
    .from(s.remediationRecords)
    .where(
      and(
        eq(s.remediationRecords.enrollmentId, enrollmentId),
        eq(s.remediationRecords.quizId, quiz.id),
        inArray(s.remediationRecords.status, ["required", "ready", "escalated"]),
      ),
    );

  const decision = decideAfterSubmit({
    correctCount: graded.correctCount,
    totalCount: graded.totalCount,
    passScore: quiz.passScore,
    escalateAfter: quiz.escalateAfter,
    priorFailedCount,
    missedQuestions: graded.results
      .filter((r) => !r.isCorrect)
      .map((r) => ({ questionId: r.questionId, lessonId: quiz.questions.find((q) => q.id === r.questionId)!.lessonId })),
    moduleLessonIds: quiz.lessonIds,
    openRemediationId: open?.id ?? null,
  });

  const [attempt] = await db
    .insert(s.attempts)
    .values({
      enrollmentId,
      quizId: quiz.id,
      attemptNo,
      status: "submitted",
      score: graded.score,
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      passed: decision.passed,
      startedAt: new Date(when.getTime() - 6 * 60_000),
      submittedAt: when,
    })
    .returning({ id: s.attempts.id });

  await db.insert(s.answers).values(
    graded.results.map((r) => ({
      attemptId: attempt.id,
      questionId: r.questionId,
      selectedOptionIds: picks[r.questionId],
      isCorrect: r.isCorrect,
      answeredAt: when,
    })),
  );

  // Close the old open record BEFORE inserting a new one (partial unique index).
  if (decision.closeOpen) {
    await db
      .update(s.remediationRecords)
      .set({
        status: decision.closeOpen.as,
        resolvedAt: when,
        resolvedByAttemptId: decision.closeOpen.as === "resolved" ? attempt.id : null,
      })
      .where(eq(s.remediationRecords.id, decision.closeOpen.id));
  }

  if (decision.create) {
    const [record] = await db
      .insert(s.remediationRecords)
      .values({
        enrollmentId,
        quizId: quiz.id,
        attemptId: attempt.id,
        status: decision.create.status,
        createdAt: when,
      })
      .returning({ id: s.remediationRecords.id });

    if (decision.create.lessonIds.length > 0) {
      await db.insert(s.remediationItems).values(
        decision.create.lessonIds.map((lessonId) => ({
          remediationId: record.id,
          lessonId,
          completedAt: opts.reviewAll ? new Date(when.getTime() + HOUR) : null,
        })),
      );
    }
    if (opts.reviewAll) {
      const next = statusAfterItemReviewed(
        decision.create.status,
        decision.create.lessonIds.map(() => ({ completed: true })),
      );
      if (next !== decision.create.status) {
        await db.update(s.remediationRecords).set({ status: next }).where(eq(s.remediationRecords.id, record.id));
      }
    }
  }

  await touch(enrollmentId, when);
  return decision.passed;
}

async function startAttemptInProgress(enrollmentId: string, quiz: QuizRec, answered: number, when: Date) {
  const [attempt] = await db
    .insert(s.attempts)
    .values({ enrollmentId, quizId: quiz.id, attemptNo: 1, status: "in_progress", startedAt: when })
    .returning({ id: s.attempts.id });
  await db.insert(s.answers).values(
    quiz.questions.slice(0, answered).map((q) => ({
      attemptId: attempt.id,
      questionId: q.id,
      selectedOptionIds: q.correctOptionIds,
      answeredAt: when,
    })),
  );
  await touch(enrollmentId, when);
}

async function finishEnrollment(enrollmentId: string, when: Date) {
  await db
    .update(s.enrollments)
    .set({ status: "completed", completedAt: when, lastActivityAt: when })
    .where(eq(s.enrollments.id, enrollmentId));
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed with NODE_ENV=production.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (put it in .env.local).");

  console.log("Wiping existing data…");
  await db.execute(sql`truncate table organizations restart identity cascade`);

  const [org] = await db
    .insert(s.organizations)
    .values({ name: "Northwind Academy", slug: "northwind-academy" })
    .returning({ id: s.organizations.id });

  const u = await createUsers(org.id);
  const c = await createCourses(org.id, { maya: u.maya, jonas: u.jonas });
  const pm = c["project-management-essentials"];
  const data = c["data-literacy-for-managers"];
  const comm = c["clear-workplace-communication"];
  const cyber = c["cybersecurity-awareness"];

  // Ava — mid-course, passed module 1 first try → "Resume lesson". Fresh enrollment in a second course.
  {
    const e = await enroll(u.ava, pm, ago(10));
    await completeLessons(e, pm.modules[0].lessonIds, 9, 8);
    await submitAttempt(e, pm.modules[0].quiz, 4, ago(7));
    await completeLessons(e, [pm.modules[1].lessonIds[0]], 3);
    await openLesson(e, pm.modules[1].lessonIds[1], ago(1));
    await db.insert(s.notes).values([
      {
        userId: u.ava,
        lessonId: pm.modules[0].lessonIds[1],
        kind: "note",
        body: "Acceptance criteria = how we know a deliverable is done. Add to our project template.",
        createdAt: ago(8),
      },
      { userId: u.ava, lessonId: pm.modules[0].lessonIds[0], kind: "bookmark", body: null, createdAt: ago(9) },
      {
        userId: u.ava,
        lessonId: pm.modules[1].lessonIds[0],
        kind: "note",
        body: "8–80 hour rule of thumb for work packages — try on the website redesign.",
        createdAt: ago(3),
      },
    ]);
    await enroll(u.ava, data, ago(0, 1));
  }

  // Ben — failed module 1 quiz once, hasn't reviewed anything → remediation "required".
  {
    const e = await enroll(u.ben, pm, ago(6));
    await completeLessons(e, pm.modules[0].lessonIds, 5, 4);
    await submitAttempt(e, pm.modules[0].quiz, 2, ago(4));
    const e2 = await enroll(u.ben, comm, ago(3));
    await completeLessons(e2, [comm.modules[0].lessonIds[0]], 2);
  }

  // Chloe — failed once, reviewed the flagged lessons → remediation "ready" (retake unlocked).
  {
    const e = await enroll(u.chloe, pm, ago(8));
    await completeLessons(e, pm.modules[0].lessonIds, 7, 4);
    await submitAttempt(e, pm.modules[0].quiz, 2, ago(6), { reviewAll: true });
    await touch(e, ago(5));
  }

  // Dev — failed three times → remediation "escalated" (gate lifted, instructor flagged).
  {
    const e = await enroll(u.dev, pm, ago(14));
    await completeLessons(e, pm.modules[0].lessonIds, 13, 4);
    await submitAttempt(e, pm.modules[0].quiz, 1, ago(12), { reviewAll: true });
    await submitAttempt(e, pm.modules[0].quiz, 1, ago(10), { reviewAll: true });
    await submitAttempt(e, pm.modules[0].quiz, 2, ago(7));
  }

  // Elena — completed the whole course (failed once, remediated, then passed).
  {
    const e = await enroll(u.elena, pm, ago(20));
    await completeLessons(e, pm.modules[0].lessonIds, 19, 4);
    await submitAttempt(e, pm.modules[0].quiz, 2, ago(18), { reviewAll: true });
    await submitAttempt(e, pm.modules[0].quiz, 4, ago(17));
    await completeLessons(e, pm.modules[1].lessonIds, 16, 24);
    await submitAttempt(e, pm.modules[1].quiz, 4, ago(13));
    await finishEnrollment(e, ago(13));

    const e2 = await enroll(u.elena, data, ago(5));
    await completeLessons(e2, data.modules[0].lessonIds, 4, 6);
    await submitAttempt(e2, data.modules[0].quiz, 3, ago(3));
  }

  // Farid — stalled: one lesson three weeks ago, nothing since.
  {
    const e = await enroll(u.farid, pm, ago(25));
    await completeLessons(e, [pm.modules[0].lessonIds[0]], 24);
    await enroll(u.farid, comm, ago(2));
  }

  // Grace — quiz attempt in progress (refresh must resume it); also finished Cybersecurity.
  {
    const e = await enroll(u.grace, data, ago(9));
    await completeLessons(e, data.modules[0].lessonIds, 8, 6);
    await startAttemptInProgress(e, data.modules[0].quiz, 2, ago(0, 2));

    const e2 = await enroll(u.grace, cyber, ago(12));
    await completeLessons(e2, cyber.modules[0].lessonIds, 11, 6);
    await submitAttempt(e2, cyber.modules[0].quiz, 3, ago(9));
    await completeLessons(e2, cyber.modules[1].lessonIds, 8, 6);
    await submitAttempt(e2, cyber.modules[1].quiz, 3, ago(6));
    await finishEnrollment(e2, ago(6));
  }

  // Hugo — remediated then passed module 1; mid-module 2. Cybersecurity lessons done, quiz not yet taken.
  {
    const e = await enroll(u.hugo, data, ago(12));
    await completeLessons(e, data.modules[0].lessonIds, 11, 6);
    await submitAttempt(e, data.modules[0].quiz, 2, ago(10), { reviewAll: true });
    await submitAttempt(e, data.modules[0].quiz, 3, ago(9));
    await completeLessons(e, [data.modules[1].lessonIds[0]], 4);
    await openLesson(e, data.modules[1].lessonIds[1], ago(0, 5));

    const e2 = await enroll(u.hugo, cyber, ago(4));
    await completeLessons(e2, cyber.modules[0].lessonIds, 3, 6);
  }

  const counts = await db.execute(sql`
    select
      (select count(*) from users) as users,
      (select count(*) from courses) as courses,
      (select count(*) from lessons) as lessons,
      (select count(*) from questions) as questions,
      (select count(*) from enrollments) as enrollments,
      (select count(*) from attempts) as attempts,
      (select count(*) from remediation_records) as remediation
  `);
  console.log("Seeded:", counts.rows[0]);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
