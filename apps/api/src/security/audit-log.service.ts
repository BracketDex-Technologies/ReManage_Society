import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import type { AuditEvent } from "../../../../packages/security/src/index.ts";

export interface AuditPersistenceClient {
  securityEvent: {
    create(input: { data: Record<string, unknown> }): Promise<unknown>;
  };
  activityLog: {
    create(input: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

@Injectable()
export class AuditLogService {
  constructor(private readonly client: AuditPersistenceClient = prisma) {}

  async record(event: AuditEvent): Promise<void> {
    await this.client.securityEvent.create({
      data: {
        societyId: event.societyId,
        userId: event.actorId,
        eventType: event.action,
        severity: event.outcome === "denied" || event.outcome === "failed" ? "warning" : "info",
        path: event.requestId,
        metadata: JSON.stringify(event.metadata),
        createdAt: new Date(event.timestamp),
      },
    });

    await this.client.activityLog.create({
      data: {
        societyId: event.societyId,
        userId: event.actorId,
        userName: event.actorId,
        action: event.action,
        module: event.targetType,
        targetId: event.targetId,
        targetLabel: event.targetId,
        details: JSON.stringify({
          outcome: event.outcome,
          requestId: event.requestId,
          metadata: event.metadata,
        }),
        createdAt: new Date(event.timestamp),
      },
    });
  }
}
