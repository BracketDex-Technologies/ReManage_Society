import { describe, expect, it } from "vitest";
import { NoticeRepository, type NoticePersistenceClient } from "./notice.repository.ts";

interface NoticeRow {
  id: string;
  societyId: string;
  title: string;
  body: string;
  category: string;
  postedBy: string;
  isPinned: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

function createClient(
  options: { notices?: NoticeRow[]; existingRead?: boolean } = {},
) {
  const log: string[] = [];
  const notices = options.notices ?? [];
  const client: NoticePersistenceClient & { log: string[] } = {
    log,
    notice: {
      create: async (input) => {
        log.push("notice.create");
        return {
          id: "notice_1",
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          ...(input.data as Record<string, unknown>),
        } as NoticeRow;
      },
      findMany: async () => notices,
      findFirst: async () => notices[0] ?? null,
    },
    noticeRead: {
      findFirst: async () =>
        options.existingRead
          ? {
              id: "read_existing",
              noticeId: "notice_1",
              societyId: "society_a",
              userId: "user_1",
              userName: "Ravi",
              flatNumber: "A-101",
              readAt: new Date("2026-06-07T01:00:00.000Z"),
            }
          : null,
      create: async (input) => {
        log.push("noticeRead.create");
        return {
          id: "read_1",
          ...(input.data as Record<string, unknown>),
        } as never;
      },
      findMany: async () => [
        {
          id: "read_1",
          noticeId: "notice_1",
          societyId: "society_a",
          userId: "user_1",
          userName: "Ravi",
          flatNumber: "A-101",
          readAt: new Date("2026-06-07T01:00:00.000Z"),
        },
      ],
    },
  };

  return client;
}

describe("NoticeRepository", () => {
  it("creates a notice with a normalized category", async () => {
    const client = createClient();
    const repository = new NoticeRepository(client);

    await expect(
      repository.createNotice({
        societyId: "society_a",
        title: "Water shutdown",
        body: "No water 10-12",
        category: "Maintenance",
        postedBy: "committee_1",
      }),
    ).resolves.toEqual({ created: true, noticeId: "notice_1", category: "maintenance" });
    expect(client.log).toEqual(["notice.create"]);
  });

  it("rejects an unsupported notice category", async () => {
    const repository = new NoticeRepository(createClient());

    await expect(
      repository.createNotice({
        societyId: "society_a",
        title: "x",
        body: "y",
        category: "spam",
        postedBy: "committee_1",
      }),
    ).rejects.toThrow(/not supported/i);
  });

  it("filters expired notices when activeOnly is set", async () => {
    const client = createClient({
      notices: [
        {
          id: "active",
          societyId: "society_a",
          title: "Active",
          body: "b",
          category: "general",
          postedBy: "c",
          isPinned: true,
          expiresAt: new Date("2026-06-10T00:00:00.000Z"),
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "expired",
          societyId: "society_a",
          title: "Expired",
          body: "b",
          category: "general",
          postedBy: "c",
          isPinned: false,
          expiresAt: new Date("2026-06-02T00:00:00.000Z"),
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
    });
    const repository = new NoticeRepository(client);

    const result = await repository.listNotices({
      societyId: "society_a",
      activeOnly: true,
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result.map((n) => n.id)).toEqual(["active"]);
  });

  it("records a read receipt once and replays duplicates idempotently", async () => {
    const fresh = new NoticeRepository(createClient());
    await expect(
      fresh.markRead({
        societyId: "society_a",
        noticeId: "notice_1",
        userId: "user_1",
        userName: "Ravi",
      }),
    ).resolves.toMatchObject({ acknowledged: true, replayed: false, dedupeKey: "notice_1:user_1" });

    const dupClient = createClient({ existingRead: true });
    const dup = new NoticeRepository(dupClient);
    await expect(
      dup.markRead({
        societyId: "society_a",
        noticeId: "notice_1",
        userId: "user_1",
        userName: "Ravi",
      }),
    ).resolves.toMatchObject({ replayed: true, readId: "read_existing" });
    expect(dupClient.log).toEqual([]);
  });
});
