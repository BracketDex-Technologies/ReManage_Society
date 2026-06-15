import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyForumModeration,
  assertThreadNotLocked,
  normalizeForumCategory,
} from "../../../../packages/community-core/src/index.ts";

interface ThreadRecord {
  id: string;
  societyId: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  isLocked: boolean;
  views: number;
  lastActivityAt: Date;
  createdAt: Date;
}

interface ReplyRecord {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface ForumPersistenceClient {
  forumThread: {
    create(input: { data: Record<string, unknown> }): Promise<ThreadRecord>;
    findFirst(input: Record<string, unknown>): Promise<ThreadRecord | null>;
    findMany(input: Record<string, unknown>): Promise<ThreadRecord[]>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<ThreadRecord>;
  };
  forumReply: {
    create(input: { data: Record<string, unknown> }): Promise<ReplyRecord>;
    findMany(input: Record<string, unknown>): Promise<ReplyRecord[]>;
  };
}

export interface CreateThreadCommand {
  societyId: string;
  authorId: string;
  title: string;
  content: string;
  category?: string;
}

export interface ReplyThreadCommand {
  societyId: string;
  threadId: string;
  authorId: string;
  content: string;
  at?: Date;
}

export interface ModerateThreadCommand {
  societyId: string;
  threadId: string;
  action: string;
}

@Injectable()
export class ForumRepository {
  constructor(
    private readonly client: ForumPersistenceClient = prisma as unknown as ForumPersistenceClient,
  ) {}

  async createThread(command: CreateThreadCommand) {
    const category = normalizeForumCategory(command.category);
    const now = new Date();

    const thread = await this.client.forumThread.create({
      data: {
        societyId: command.societyId,
        authorId: command.authorId,
        title: command.title,
        content: command.content,
        category,
        isPinned: false,
        isLocked: false,
        views: 0,
        lastActivityAt: now,
      },
    });

    return { created: true as const, threadId: thread.id, category };
  }

  async replyThread(command: ReplyThreadCommand) {
    const thread = await this.requireThread(command.societyId, command.threadId);
    assertThreadNotLocked(thread.isLocked);
    const at = command.at ?? new Date();

    const reply = await this.client.forumReply.create({
      data: {
        threadId: command.threadId,
        authorId: command.authorId,
        content: command.content,
      },
    });

    await this.client.forumThread.update({
      where: { id: thread.id },
      data: { lastActivityAt: at },
    });

    return { replied: true as const, replyId: reply.id, threadId: thread.id };
  }

  async moderateThread(command: ModerateThreadCommand) {
    const thread = await this.requireThread(command.societyId, command.threadId);
    const change = applyForumModeration(command.action);

    const updated = await this.client.forumThread.update({
      where: { id: thread.id },
      data: change,
    });

    return {
      moderated: true as const,
      threadId: updated.id,
      isPinned: updated.isPinned,
      isLocked: updated.isLocked,
    };
  }

  async listThreads(societyId: string, category?: string) {
    return this.client.forumThread.findMany({
      where: { societyId, ...(category ? { category } : {}) },
      orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }],
    });
  }

  async listReplies(threadId: string) {
    return this.client.forumReply.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
  }

  private async requireThread(societyId: string, threadId: string): Promise<ThreadRecord> {
    const thread = await this.client.forumThread.findFirst({ where: { id: threadId, societyId } });

    if (!thread) {
      throw new NotFoundException({ error: "not_found", reason: "Thread not found" });
    }

    return thread;
  }
}
