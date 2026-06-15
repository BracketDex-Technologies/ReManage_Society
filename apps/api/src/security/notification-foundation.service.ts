import { Injectable } from "@nestjs/common";

export type NotificationChannel = "email" | "push" | "sms";

export interface NotificationFoundationOptions {
  now?: () => string;
}

export interface NotificationJobInput {
  societyId: string;
  recipientId: string;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
}

export interface NotificationJob {
  queue: "notifications";
  idempotencyKey: string;
  societyId: string;
  recipientId: string;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
  status: "queued";
  createdAt: string;
}

@Injectable()
export class NotificationFoundationService {
  private readonly now: () => string;

  constructor(options: NotificationFoundationOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  createNotificationJob(input: NotificationJobInput): NotificationJob {
    return {
      queue: "notifications",
      idempotencyKey: [
        input.societyId,
        input.recipientId,
        input.channel,
        input.template,
        this.primaryPayloadId(input.payload),
      ].join(":"),
      societyId: input.societyId,
      recipientId: input.recipientId,
      channel: input.channel,
      template: input.template,
      payload: input.payload,
      status: "queued",
      createdAt: this.now(),
    };
  }

  private primaryPayloadId(payload: Record<string, unknown>): string {
    const id = payload.noticeId ?? payload.documentId ?? payload.eventId ?? payload.id;
    if (typeof id === "string" && id.trim()) {
      return id;
    }

    return "generic";
  }
}

