import { describe, expect, it } from "vitest";
import { assertRsvpCapacity, castPollVote, type PollVoteState } from "@society/community-core";
import { NoticeRepository, type NoticePersistenceClient } from "../../apps/api/src/community/notice.repository.ts";

describe("community critical contract", () => {
  it("dedupes notice read receipts", async () => {
    const log: string[] = [];
    const client: NoticePersistenceClient = {
      notice: {
        create: async () => ({
          id: "n1",
          societyId: "society_a",
          title: "t",
          body: "b",
          category: "general",
          postedBy: "x",
          isPinned: false,
          expiresAt: null,
          createdAt: new Date(),
        }),
        findMany: async () => [],
        findFirst: async () => ({
          id: "n1",
          societyId: "society_a",
          title: "t",
          body: "b",
          category: "general",
          postedBy: "x",
          isPinned: false,
          expiresAt: null,
          createdAt: new Date(),
        }),
      },
      noticeRead: {
        findFirst: async () => ({
          id: "read_existing",
          noticeId: "n1",
          societyId: "society_a",
          userId: "u1",
          userName: "Ravi",
          flatNumber: "A-101",
          readAt: new Date(),
        }),
        create: async () => {
          log.push("create");
          return {
            id: "read_1",
            noticeId: "n1",
            societyId: "society_a",
            userId: "u1",
            userName: "Ravi",
            flatNumber: "A-101",
            readAt: new Date(),
          };
        },
        findMany: async () => [],
      },
    };
    const repo = new NoticeRepository(client);
    const result = await repo.markRead({
      societyId: "society_a",
      noticeId: "n1",
      userId: "u1",
      userName: "Ravi",
      flatNumber: "A-101",
    });
    expect(result.replayed).toBe(true);
    expect(log).toEqual([]);
  });

  it("rejects duplicate poll votes", () => {
    const state: PollVoteState = {
      options: ["Yes", "No"],
      votes: { "0": 1 },
      voters: ["A-101"],
      status: "active",
    };
    expect(() =>
      castPollVote({
        state,
        voterRef: "A-101",
        optionIndex: 1,
        now: new Date("2026-06-07T12:00:00.000Z"),
      }),
    ).toThrow(/already voted/);
  });

  it("rejects votes on closed polls", () => {
    expect(() =>
      castPollVote({
        state: { options: ["Yes", "No"], votes: {}, voters: [], status: "closed" },
        voterRef: "A-102",
        optionIndex: 0,
        now: new Date("2026-06-07T12:00:00.000Z"),
      }),
    ).toThrow(/not open/);
  });

  it("enforces RSVP capacity at domain layer", () => {
    expect(() =>
      assertRsvpCapacity({ maxAttendees: 1, currentAttending: 1, willAttend: true }),
    ).toThrow(/capacity/i);
  });
});
