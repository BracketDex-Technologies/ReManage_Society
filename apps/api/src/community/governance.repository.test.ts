import { describe, expect, it } from "vitest";
import {
  GovernanceRepository,
  type GovernancePersistenceClient,
} from "./governance.repository.ts";

interface PollRow {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  options: string;
  votes: string;
  voters: string;
  createdBy: string;
  status: string;
  closesAt: Date | null;
  createdAt: Date;
}

function createClient(poll?: Partial<PollRow>) {
  const log: Array<{ op: string; data: Record<string, unknown> }> = [];
  const pollRow: PollRow | null = poll
    ? {
        id: "poll_1",
        societyId: "society_a",
        title: "Lift vendor",
        description: null,
        options: JSON.stringify(["A", "B", "C"]),
        votes: "{}",
        voters: "[]",
        createdBy: "c1",
        status: "active",
        closesAt: null,
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        ...poll,
      }
    : null;

  const client: GovernancePersistenceClient & { log: typeof log } = {
    log,
    meetingMinutes: {
      create: async (input) => {
        log.push({ op: "meeting.create", data: input.data });
        return { id: "meeting_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findMany: async () => [],
    },
    poll: {
      create: async (input) => {
        log.push({ op: "poll.create", data: input.data });
        return { id: "poll_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findFirst: async () => pollRow as never,
      findMany: async () => (pollRow ? [pollRow] : []) as never,
      update: async (input) => {
        log.push({ op: "poll.update", data: input.data });
        return { ...(pollRow ?? {}), ...(input.data as Record<string, unknown>) } as never;
      },
    },
  };

  return client;
}

describe("GovernanceRepository", () => {
  it("records a meeting with attendee count", async () => {
    const client = createClient();
    const repository = new GovernanceRepository(client);

    await expect(
      repository.recordMeeting({
        societyId: "society_a",
        title: "AGM 2026",
        date: new Date("2026-06-07T00:00:00.000Z"),
        meetingType: "AGM",
        agenda: "Budget",
        minutes: "Approved",
        attendees: ["A-101", "A-102"],
        recordedBy: "c1",
      }),
    ).resolves.toMatchObject({ recorded: true, meetingType: "agm", attendeeCount: 2 });
  });

  it("creates a poll with validated options", async () => {
    const client = createClient();
    const repository = new GovernanceRepository(client);

    await expect(
      repository.createPoll({
        societyId: "society_a",
        title: "Lift vendor",
        options: ["A", "B"],
        createdBy: "c1",
      }),
    ).resolves.toMatchObject({ created: true, options: ["A", "B"] });
    expect(client.log.at(-1)?.data).toMatchObject({ votes: "{}", voters: "[]", status: "active" });
  });

  it("casts a vote and persists updated tally", async () => {
    const client = createClient({});
    const repository = new GovernanceRepository(client);

    await expect(
      repository.castVote({
        societyId: "society_a",
        pollId: "poll_1",
        voterRef: "A-101",
        optionIndex: 1,
        now: new Date("2026-06-07T01:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ voted: true });
    expect(client.log.at(-1)?.data).toMatchObject({ votes: '{"1":1}', voters: '["A-101"]' });
  });

  it("rejects a duplicate voter", async () => {
    const client = createClient({ voters: JSON.stringify(["A-101"]) });
    const repository = new GovernanceRepository(client);

    await expect(
      repository.castVote({
        societyId: "society_a",
        pollId: "poll_1",
        voterRef: "A-101",
        optionIndex: 1,
      }),
    ).rejects.toThrow(/already voted/);
  });

  it("rejects voting on a closed poll", async () => {
    const client = createClient({ status: "closed" });
    const repository = new GovernanceRepository(client);

    await expect(
      repository.castVote({
        societyId: "society_a",
        pollId: "poll_1",
        voterRef: "A-102",
        optionIndex: 0,
      }),
    ).rejects.toThrow(/not open/);
  });

  it("returns poll results", async () => {
    const client = createClient({ votes: JSON.stringify({ "0": 3, "1": 1 }) });
    const repository = new GovernanceRepository(client);

    await expect(
      repository.getPollResults("society_a", "poll_1"),
    ).resolves.toMatchObject({ totalVotes: 4 });
  });

  it("throws when poll missing", async () => {
    const repository = new GovernanceRepository(createClient());

    await expect(repository.getPollResults("society_a", "missing")).rejects.toMatchObject({
      status: 404,
    });
  });
});
