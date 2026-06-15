import { describe, expect, it } from "vitest";
import {
  castPollVote,
  isPollOpen,
  normalizeMeetingType,
  planPoll,
  tallyPoll,
  type PollVoteState,
} from "./index.ts";

describe("normalizeMeetingType", () => {
  it("normalizes and defaults", () => {
    expect(normalizeMeetingType(undefined)).toBe("general");
    expect(normalizeMeetingType("AGM")).toBe("agm");
  });

  it("rejects unsupported meeting types", () => {
    expect(() => normalizeMeetingType("party")).toThrow();
  });
});

describe("planPoll", () => {
  it("validates and trims options", () => {
    expect(
      planPoll({ title: " Lift vendor ", options: [" A ", "B", ""] }),
    ).toEqual({ title: "Lift vendor", options: ["A", "B"], status: "active" });
  });

  it("requires at least two unique options", () => {
    expect(() => planPoll({ title: "x", options: ["only"] })).toThrow(/two/);
    expect(() => planPoll({ title: "x", options: ["A", "A"] })).toThrow(/unique/);
  });
});

describe("isPollOpen", () => {
  it("is closed when status is closed or past closesAt", () => {
    const now = new Date("2026-06-07T12:00:00.000Z");
    expect(isPollOpen({ status: "closed", now })).toBe(false);
    expect(isPollOpen({ status: "active", now })).toBe(true);
    expect(
      isPollOpen({ status: "active", closesAt: new Date("2026-06-07T11:00:00.000Z"), now }),
    ).toBe(false);
    expect(
      isPollOpen({ status: "active", closesAt: new Date("2026-06-07T13:00:00.000Z"), now }),
    ).toBe(true);
  });
});

describe("castPollVote", () => {
  const baseState: PollVoteState = {
    options: ["A", "B", "C"],
    votes: { "0": 2 },
    voters: ["A-101"],
    status: "active",
  };
  const now = new Date("2026-06-07T12:00:00.000Z");

  it("records a new vote and voter", () => {
    const result = castPollVote({ state: baseState, voterRef: "A-102", optionIndex: 1, now });
    expect(result.votes).toEqual({ "0": 2, "1": 1 });
    expect(result.voters).toEqual(["A-101", "A-102"]);
  });

  it("rejects a duplicate voter", () => {
    expect(() =>
      castPollVote({ state: baseState, voterRef: "A-101", optionIndex: 1, now }),
    ).toThrow(/already voted/);
  });

  it("rejects an out-of-range option", () => {
    expect(() =>
      castPollVote({ state: baseState, voterRef: "A-102", optionIndex: 5, now }),
    ).toThrow(/out of range/);
  });

  it("rejects voting on a closed poll", () => {
    expect(() =>
      castPollVote({ state: { ...baseState, status: "closed" }, voterRef: "A-102", optionIndex: 1, now }),
    ).toThrow(/not open/);
  });
});

describe("tallyPoll", () => {
  it("computes per-option counts and total", () => {
    expect(tallyPoll({ options: ["A", "B"], votes: { "0": 3, "1": 1 } })).toEqual({
      rows: [
        { index: 0, option: "A", count: 3 },
        { index: 1, option: "B", count: 1 },
      ],
      totalVotes: 4,
    });
  });
});
