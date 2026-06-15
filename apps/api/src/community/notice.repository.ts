import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  isNoticeActive,
  noticeReadDedupeKey,
  planNotice,
  type NoticeCategory,
} from "../../../../packages/community-core/src/index.ts";

interface NoticeRecord {
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

interface NoticeReadRecord {
  id: string;
  noticeId: string;
  societyId: string;
  userId: string;
  userName: string;
  flatNumber: string | null;
  readAt: Date;
}

export interface NoticePersistenceClient {
  notice: {
    create(input: { data: Record<string, unknown> }): Promise<NoticeRecord>;
    findMany(input: Record<string, unknown>): Promise<NoticeRecord[]>;
    findFirst(input: Record<string, unknown>): Promise<NoticeRecord | null>;
  };
  noticeRead: {
    findFirst(input: Record<string, unknown>): Promise<NoticeReadRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<NoticeReadRecord>;
    findMany(input: Record<string, unknown>): Promise<NoticeReadRecord[]>;
  };
}

export interface CreateNoticeCommand {
  societyId: string;
  title: string;
  body: string;
  category?: string;
  postedBy: string;
  isPinned?: boolean;
  expiresAt?: Date;
}

export interface ListNoticesQuery {
  societyId: string;
  category?: string;
  activeOnly?: boolean;
  now?: Date;
}

export interface MarkNoticeReadCommand {
  societyId: string;
  noticeId: string;
  userId: string;
  userName: string;
  flatNumber?: string;
  readAt?: Date;
}

@Injectable()
export class NoticeRepository {
  constructor(
    private readonly client: NoticePersistenceClient = prisma as unknown as NoticePersistenceClient,
  ) {}

  async createNotice(
    command: CreateNoticeCommand,
  ): Promise<{ created: true; noticeId: string; category: NoticeCategory }> {
    const plan = planNotice(command);

    const notice = await this.client.notice.create({
      data: {
        societyId: plan.societyId,
        title: plan.title,
        body: plan.body,
        category: plan.category,
        postedBy: plan.postedBy,
        isPinned: plan.isPinned,
        expiresAt: plan.expiresAt ? new Date(plan.expiresAt) : null,
      },
    });

    return { created: true, noticeId: notice.id, category: plan.category };
  }

  async listNotices(query: ListNoticesQuery): Promise<NoticeRecord[]> {
    const notices = await this.client.notice.findMany({
      where: {
        societyId: query.societyId,
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    if (!query.activeOnly) {
      return notices;
    }

    const now = query.now ?? new Date();
    return notices.filter((notice) =>
      isNoticeActive({ expiresAt: notice.expiresAt, now }),
    );
  }

  async markRead(
    command: MarkNoticeReadCommand,
  ): Promise<{ acknowledged: true; replayed: boolean; readId: string; dedupeKey: string }> {
    const dedupeKey = noticeReadDedupeKey({
      noticeId: command.noticeId,
      userId: command.userId,
    });

    const existing = await this.client.noticeRead.findFirst({
      where: {
        societyId: command.societyId,
        noticeId: command.noticeId,
        userId: command.userId,
      },
    });

    if (existing) {
      return { acknowledged: true, replayed: true, readId: existing.id, dedupeKey };
    }

    const record = await this.client.noticeRead.create({
      data: {
        societyId: command.societyId,
        noticeId: command.noticeId,
        userId: command.userId,
        userName: command.userName,
        flatNumber: command.flatNumber ?? null,
        readAt: command.readAt ?? new Date(),
      },
    });

    return { acknowledged: true, replayed: false, readId: record.id, dedupeKey };
  }

  async listReadReceipts(societyId: string, noticeId: string): Promise<NoticeReadRecord[]> {
    return this.client.noticeRead.findMany({
      where: { societyId, noticeId },
      orderBy: { readAt: "desc" },
    });
  }
}
