import { describe, expect, it } from "vitest";
import { ForumRepository, type ForumPersistenceClient } from "./forum.repository.ts";

function createClient(thread?: { isLocked?: boolean; isPinned?: boolean }) {
  const log: Array<{ op: string; data?: Record<string, unknown> }> = [];
  const threadRow = thread
    ? {
        id: "thread_1",
        societyId: "society_a",
        authorId: "u1",
        title: "Hi",
        content: "Hello",
        category: "general",
        isPinned: thread.isPinned ?? false,
        isLocked: thread.isLocked ?? false,
        views: 0,
        lastActivityAt: new Date("2026-06-07T00:00:00.000Z"),
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
      }
    : null;

  const client: ForumPersistenceClient & { log: typeof log } = {
    log,
    forumThread: {
      create: async (input) => {
        log.push({ op: "thread.create", data: input.data });
        return { id: "thread_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findFirst: async () => threadRow as never,
      findMany: async () => (threadRow ? [threadRow] : []) as never,
      update: async (input) => {
        log.push({ op: "thread.update", data: input.data });
        return { ...(threadRow ?? {}), ...(input.data as Record<string, unknown>) } as never;
      },
    },
    forumReply: {
      create: async (input) => {
        log.push({ op: "reply.create", data: input.data });
        return { id: "reply_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findMany: async () => [],
    },
  };

  return client;
}

describe("ForumRepository", () => {
  it("creates a thread with normalized category", async () => {
    const repository = new ForumRepository(createClient());

    await expect(
      repository.createThread({
        societyId: "society_a",
        authorId: "u1",
        title: "Lift",
        content: "Broken",
        category: "Maintenance",
      }),
    ).resolves.toMatchObject({ created: true, category: "maintenance" });
  });

  it("blocks replies to a locked thread", async () => {
    const repository = new ForumRepository(createClient({ isLocked: true }));

    await expect(
      repository.replyThread({
        societyId: "society_a",
        threadId: "thread_1",
        authorId: "u2",
        content: "Me too",
      }),
    ).rejects.toThrow(/locked/);
  });

  it("adds a reply and bumps lastActivityAt", async () => {
    const client = createClient({ isLocked: false });
    const repository = new ForumRepository(client);

    await expect(
      repository.replyThread({
        societyId: "society_a",
        threadId: "thread_1",
        authorId: "u2",
        content: "Me too",
        at: new Date("2026-06-08T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ replied: true });
    expect(client.log.some((entry) => entry.op === "thread.update")).toBe(true);
  });

  it("pins a thread via moderation", async () => {
    const repository = new ForumRepository(createClient({ isPinned: false }));

    await expect(
      repository.moderateThread({ societyId: "society_a", threadId: "thread_1", action: "pin" }),
    ).resolves.toMatchObject({ isPinned: true });
  });
});
