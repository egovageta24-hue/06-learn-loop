import { describe, expect, it } from "vitest";
import { getNextAction } from "../../src/lib/learning/next-action";
import { computeProgress } from "../../src/lib/learning/progress";
import {
  canStartAttempt,
  decideAfterSubmit,
  statusAfterItemReviewed,
  type SubmitDecisionInput,
} from "../../src/lib/learning/remediation";
import { gradeQuestion, hasPassed, scoreAttempt } from "../../src/lib/learning/scoring";
import {
  emptyEnrollmentState,
  type CourseStructure,
  type EnrollmentState,
} from "../../src/lib/learning/types";

const course: CourseStructure = {
  slug: "pm-essentials",
  modules: [
    {
      id: "m1",
      title: "Foundations",
      position: 1,
      lessons: [
        { id: "l1", title: "What is a project?", position: 1 },
        { id: "l2", title: "Scope", position: 2 },
      ],
      quiz: { id: "q1", passScore: 70, escalateAfter: 3 },
    },
    {
      id: "m2",
      title: "Planning",
      position: 2,
      lessons: [{ id: "l3", title: "Schedules", position: 1 }],
      quiz: null,
    },
  ],
};

const state = (patch: Partial<EnrollmentState> = {}): EnrollmentState => ({
  ...emptyEnrollmentState(),
  ...patch,
});

describe("scoring", () => {
  it("grades by exact set match", () => {
    expect(gradeQuestion(["a"], ["a"])).toBe(true);
    expect(gradeQuestion(["a", "b"], ["b", "a"])).toBe(true);
    expect(gradeQuestion(["a", "b"], ["a"])).toBe(false); // partial = wrong
    expect(gradeQuestion(["a"], ["a", "b"])).toBe(false); // extra = wrong
    expect(gradeQuestion(["a"], [])).toBe(false);
  });

  it("scores an attempt and floors the percentage", () => {
    const qs = [
      { id: "1", correctOptionIds: ["a"] },
      { id: "2", correctOptionIds: ["b"] },
      { id: "3", correctOptionIds: ["c"] },
    ];
    const r = scoreAttempt(qs, { "1": ["a"], "2": ["b"], "3": ["x"] });
    expect(r.correctCount).toBe(2);
    expect(r.score).toBe(66); // 66.6… floored, never rounded up
    expect(r.results.map((x) => x.isCorrect)).toEqual([true, true, false]);
  });

  it("treats unanswered questions as wrong and never passes an empty quiz", () => {
    expect(scoreAttempt([{ id: "1", correctOptionIds: ["a"] }], {}).score).toBe(0);
    expect(hasPassed(0, 0, 70)).toBe(false);
  });

  it("passes on the exact boundary using integer math", () => {
    expect(hasPassed(7, 10, 70)).toBe(true);
    expect(hasPassed(2, 3, 67)).toBe(false); // 66.6% < 67%
    expect(hasPassed(2, 3, 66)).toBe(true);
  });
});

describe("computeProgress", () => {
  it("counts lessons and quizzes and locks later modules", () => {
    const p = computeProgress(course, state());
    expect(p.totalUnits).toBe(4);
    expect(p.percent).toBe(0);
    expect(p.modules.map((m) => m.status)).toEqual(["available", "locked"]);
  });

  it("unlocks the next module only once the quiz is passed", () => {
    const lessonsOnly = computeProgress(course, state({ completedLessonIds: ["l1", "l2"] }));
    expect(lessonsOnly.modules[1].status).toBe("locked");

    const passed = computeProgress(
      course,
      state({ completedLessonIds: ["l1", "l2"], passedQuizIds: ["q1"] }),
    );
    expect(passed.modules.map((m) => m.status)).toEqual(["complete", "available"]);
    expect(passed.percent).toBe(75);
  });

  it("reports completion", () => {
    const p = computeProgress(
      course,
      state({ completedLessonIds: ["l1", "l2", "l3"], passedQuizIds: ["q1"] }),
    );
    expect(p.percent).toBe(100);
    expect(p.isComplete).toBe(true);
  });
});

describe("getNextAction", () => {
  const allLessons = ["l1", "l2"];

  it("starts the first lesson for a fresh enrollment", () => {
    const a = getNextAction(course, state());
    expect(a).toMatchObject({ type: "start_lesson", lessonId: "l1" });
    expect(a.href).toBe("/learn/pm-essentials/lessons/l1");
  });

  it("resumes the lesson the learner was last on", () => {
    const a = getNextAction(course, state({ lastLessonId: "l1" }));
    expect(a).toMatchObject({ type: "resume_lesson", lessonId: "l1" });
  });

  it("starts the next unopened lesson once the last one is complete", () => {
    const a = getNextAction(course, state({ completedLessonIds: ["l1"], lastLessonId: "l1" }));
    expect(a).toMatchObject({ type: "start_lesson", lessonId: "l2" });
  });

  it("offers the quiz after all lessons in the module", () => {
    const a = getNextAction(course, state({ completedLessonIds: allLessons }));
    expect(a).toMatchObject({ type: "take_quiz", quizId: "q1" });
  });

  it("resumes an in-progress attempt before anything else", () => {
    const a = getNextAction(
      course,
      state({
        completedLessonIds: allLessons,
        inProgressAttempts: { q1: "att2" },
        openRemediation: {
          q1: { id: "r1", attemptId: "att1", status: "required", items: [{ lessonId: "l1", completed: false }] },
        },
      }),
    );
    expect(a).toMatchObject({ type: "resume_quiz", attemptId: "att2" });
  });

  it("sends the learner to remediation while review items remain", () => {
    const a = getNextAction(
      course,
      state({
        completedLessonIds: allLessons,
        openRemediation: {
          q1: {
            id: "r1",
            attemptId: "att1",
            status: "required",
            items: [
              { lessonId: "l1", completed: true },
              { lessonId: "l2", completed: false },
            ],
          },
        },
      }),
    );
    expect(a).toMatchObject({ type: "review_remediation", remaining: 1, remediationId: "r1" });
    expect(a.href).toBe("/learn/pm-essentials/quizzes/q1/attempts/att1");
  });

  it("offers a retake once remediation is ready", () => {
    const a = getNextAction(
      course,
      state({
        completedLessonIds: allLessons,
        openRemediation: {
          q1: { id: "r1", attemptId: "att1", status: "ready", items: [{ lessonId: "l1", completed: true }] },
        },
      }),
    );
    expect(a).toMatchObject({ type: "retake_quiz", escalated: false });
  });

  it("never blocks an escalated learner, even with unreviewed items", () => {
    const a = getNextAction(
      course,
      state({
        completedLessonIds: allLessons,
        openRemediation: {
          q1: { id: "r3", attemptId: "att3", status: "escalated", items: [{ lessonId: "l1", completed: false }] },
        },
      }),
    );
    expect(a).toMatchObject({ type: "retake_quiz", escalated: true });
  });

  it("moves to the next module after the quiz is passed", () => {
    const a = getNextAction(course, state({ completedLessonIds: allLessons, passedQuizIds: ["q1"] }));
    expect(a).toMatchObject({ type: "start_lesson", lessonId: "l3" });
  });

  it("reports completion and never returns undefined", () => {
    const a = getNextAction(
      course,
      state({ completedLessonIds: ["l1", "l2", "l3"], passedQuizIds: ["q1"] }),
    );
    expect(a.type).toBe("course_complete");
  });

  it("handles an empty course", () => {
    expect(getNextAction({ slug: "x", modules: [] }, state()).type).toBe("no_content");
  });
});

describe("remediation state machine", () => {
  const base: SubmitDecisionInput = {
    correctCount: 1,
    totalCount: 4,
    passScore: 70,
    escalateAfter: 3,
    priorFailedCount: 0,
    missedQuestions: [
      { questionId: "a", lessonId: "l1" },
      { questionId: "b", lessonId: "l1" },
      { questionId: "c", lessonId: "l2" },
    ],
    moduleLessonIds: ["l1", "l2", "l3"],
    openRemediationId: null,
  };

  it("creates a required record with distinct linked lessons on a fail", () => {
    const d = decideAfterSubmit(base);
    expect(d.passed).toBe(false);
    expect(d.failedCount).toBe(1);
    expect(d.create).toEqual({ status: "required", lessonIds: ["l1", "l2"] });
    expect(d.closeOpen).toBeNull();
  });

  it("falls back to every module lesson when no missed question is linked", () => {
    const d = decideAfterSubmit({
      ...base,
      missedQuestions: [{ questionId: "a", lessonId: null }],
    });
    expect(d.create).toEqual({ status: "required", lessonIds: ["l1", "l2", "l3"] });
  });

  it("goes straight to ready when there is nothing to review", () => {
    const d = decideAfterSubmit({ ...base, missedQuestions: [], moduleLessonIds: [] });
    expect(d.create).toEqual({ status: "ready", lessonIds: [] });
  });

  it("supersedes the previous open record on a repeat failure", () => {
    const d = decideAfterSubmit({ ...base, priorFailedCount: 1, openRemediationId: "r1" });
    expect(d.closeOpen).toEqual({ id: "r1", as: "superseded" });
    expect(d.create?.status).toBe("required");
    expect(d.failedCount).toBe(2);
  });

  it("escalates on the Nth failure and keeps escalating after", () => {
    expect(decideAfterSubmit({ ...base, priorFailedCount: 2 }).create?.status).toBe("escalated");
    expect(decideAfterSubmit({ ...base, priorFailedCount: 5 }).create?.status).toBe("escalated");
  });

  it("resolves the open record and creates nothing on a pass", () => {
    const d = decideAfterSubmit({
      ...base,
      correctCount: 3,
      priorFailedCount: 2,
      openRemediationId: "r2",
    });
    expect(d.passed).toBe(true);
    expect(d.closeOpen).toEqual({ id: "r2", as: "resolved" });
    expect(d.create).toBeNull();
  });

  it("flips required → ready only when every item is reviewed", () => {
    expect(statusAfterItemReviewed("required", [{ completed: true }, { completed: false }])).toBe("required");
    expect(statusAfterItemReviewed("required", [{ completed: true }, { completed: true }])).toBe("ready");
    expect(statusAfterItemReviewed("escalated", [{ completed: false }])).toBe("escalated");
  });

  it("gates retakes only on unreviewed required items", () => {
    expect(canStartAttempt(null)).toBe(true);
    expect(canStartAttempt({ status: "required", items: [{ completed: false }] })).toBe(false);
    expect(canStartAttempt({ status: "required", items: [{ completed: true }] })).toBe(true);
    expect(canStartAttempt({ status: "ready", items: [{ completed: false }] })).toBe(true);
    expect(canStartAttempt({ status: "escalated", items: [{ completed: false }] })).toBe(true);
  });
});
