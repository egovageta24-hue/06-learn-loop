import { describe, expect, it } from "vitest";
import { INACTIVE_DAYS, isAtRisk, learnerStatus } from "../../src/lib/learning/risk";

const now = new Date("2026-10-30T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const base = { complete: false, doneUnits: 3, lastActivityAt: daysAgo(1), now, openRemediation: [] as never[] };

describe("learnerStatus", () => {
  it("is on_track for recent activity", () => {
    expect(learnerStatus(base)).toBe("on_track");
  });

  it("is not_started when nothing is done yet", () => {
    expect(learnerStatus({ ...base, doneUnits: 0 })).toBe("not_started");
  });

  it("flags inactivity at the threshold, not before", () => {
    expect(learnerStatus({ ...base, lastActivityAt: daysAgo(INACTIVE_DAYS - 1) })).toBe("on_track");
    expect(learnerStatus({ ...base, lastActivityAt: daysAgo(INACTIVE_DAYS) })).toBe("inactive");
  });

  it("treats a never-started but long-idle learner as inactive", () => {
    expect(learnerStatus({ ...base, doneUnits: 0, lastActivityAt: daysAgo(30) })).toBe("inactive");
  });

  it("shows review_required for a required remediation", () => {
    expect(learnerStatus({ ...base, openRemediation: ["required"] })).toBe("review_required");
  });

  it("escalated outranks inactive and review", () => {
    expect(learnerStatus({ ...base, lastActivityAt: daysAgo(40), openRemediation: ["escalated"] })).toBe("escalated");
  });

  it("completed outranks everything", () => {
    expect(
      learnerStatus({ ...base, complete: true, lastActivityAt: daysAgo(90), openRemediation: ["escalated"] }),
    ).toBe("completed");
  });

  it("only escalated and inactive are at risk", () => {
    expect(isAtRisk("escalated")).toBe(true);
    expect(isAtRisk("inactive")).toBe(true);
    expect(isAtRisk("review_required")).toBe(false);
    expect(isAtRisk("on_track")).toBe(false);
    expect(isAtRisk("completed")).toBe(false);
  });
});
