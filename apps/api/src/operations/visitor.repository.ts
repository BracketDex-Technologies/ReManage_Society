import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyVisitorTransition,
  patrolScanDedupeKey,
  planVisitorLog,
  type VisitorStatus,
} from "../../../../packages/operations-core/src/index.ts";

interface VisitorRecord {
  id: string;
  societyId: string;
  flatNumber: string;
  status: string;
}

interface PatrolRecord {
  id: string;
}

export interface OperationsPersistenceClient {
  visitor: {
    findFirst(input: Record<string, unknown>): Promise<VisitorRecord | null>;
    findUnique(input: { where: { id: string } }): Promise<VisitorRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<VisitorRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<VisitorRecord>;
    findMany(input: Record<string, unknown>): Promise<VisitorRecord[]>;
  };
  guardPatrol: {
    findFirst(input: Record<string, unknown>): Promise<PatrolRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<PatrolRecord>;
    findMany(input: Record<string, unknown>): Promise<PatrolRecord[]>;
  };
}

export interface VisitorLogCommand {
  societyId: string;
  flatNumber: string;
  flatId?: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  isPreApproved?: boolean;
  arrivedAt: Date;
  passcode?: string;
  guardId?: string;
}

export interface VisitorLogResult {
  logged: true;
  replayed: boolean;
  visitorId: string;
  status: string;
}

export interface VisitorRespondCommand {
  societyId: string;
  visitorId: string;
  decision: "approve" | "reject";
  respondedAt: Date;
  residentResponse?: string;
}

export interface VisitorTransitionCommand {
  societyId: string;
  visitorId: string;
  action: "enter" | "exit" | "cancel";
  at: Date;
}

export interface VisitorMutationResult {
  visitorId: string;
  status: string;
  action: string;
}

export interface PatrolScanCommand {
  societyId: string;
  guardId: string;
  checkpoint: string;
  scannedAt: Date;
  notes?: string;
  photoUrl?: string;
}

export interface PatrolScanResult {
  recorded: true;
  replayed: boolean;
  patrolId: string;
}

@Injectable()
export class VisitorRepository {
  constructor(
    private readonly client: OperationsPersistenceClient = prisma as unknown as OperationsPersistenceClient,
  ) {}

  async logVisitor(command: VisitorLogCommand): Promise<VisitorLogResult> {
    const plan = planVisitorLog(command);

    const existing = await this.client.visitor.findFirst({
      where: {
        societyId: plan.societyId,
        flatNumber: plan.flatNumber,
        arrivedAt: command.arrivedAt,
        ...(plan.phone ? { phone: plan.phone } : { visitorName: plan.visitorName }),
      },
    });

    if (existing) {
      return { logged: true, replayed: true, visitorId: existing.id, status: existing.status };
    }

    const created = await this.client.visitor.create({
      data: {
        societyId: plan.societyId,
        flatNumber: plan.flatNumber,
        flatId: command.flatId ?? null,
        visitorName: plan.visitorName,
        phone: plan.phone ?? null,
        purpose: plan.purpose,
        vehicleNo: plan.vehicleNo ?? null,
        status: plan.status,
        isPreApproved: plan.isPreApproved,
        arrivedAt: command.arrivedAt,
        entryTime: plan.status === "inside" ? command.arrivedAt : null,
        passcode: command.passcode ?? null,
        guardId: command.guardId ?? null,
      },
    });

    return { logged: true, replayed: false, visitorId: created.id, status: created.status };
  }

  async respondToVisitor(command: VisitorRespondCommand): Promise<VisitorMutationResult> {
    const visitor = await this.requireVisitor(command.societyId, command.visitorId);
    const { status } = applyVisitorTransition({
      current: visitor.status as VisitorStatus,
      action: command.decision,
    });

    const updated = await this.client.visitor.update({
      where: { id: command.visitorId },
      data: {
        status,
        residentResponse: command.residentResponse ?? command.decision,
        respondedAt: command.respondedAt,
      },
    });

    return { visitorId: updated.id, status: updated.status, action: command.decision };
  }

  async transitionVisitor(command: VisitorTransitionCommand): Promise<VisitorMutationResult> {
    const visitor = await this.requireVisitor(command.societyId, command.visitorId);
    const { status } = applyVisitorTransition({
      current: visitor.status as VisitorStatus,
      action: command.action,
    });

    const data: Record<string, unknown> = { status };
    if (command.action === "enter") {
      data.entryTime = command.at;
    } else if (command.action === "exit") {
      data.exitTime = command.at;
    }

    const updated = await this.client.visitor.update({
      where: { id: command.visitorId },
      data,
    });

    return { visitorId: updated.id, status: updated.status, action: command.action };
  }

  async listVisitors(societyId: string, status?: string): Promise<VisitorRecord[]> {
    return this.client.visitor.findMany({
      where: {
        societyId,
        ...(status ? { status } : {}),
      },
      orderBy: { arrivedAt: "desc" },
    });
  }

  async scanPatrol(command: PatrolScanCommand): Promise<PatrolScanResult> {
    // Validates the checkpoint and gives a deterministic offline-replay key.
    patrolScanDedupeKey(command);

    const existing = await this.client.guardPatrol.findFirst({
      where: {
        societyId: command.societyId,
        guardId: command.guardId,
        checkpoint: command.checkpoint.trim(),
        scannedAt: command.scannedAt,
      },
    });

    if (existing) {
      return { recorded: true, replayed: true, patrolId: existing.id };
    }

    const created = await this.client.guardPatrol.create({
      data: {
        societyId: command.societyId,
        guardId: command.guardId,
        checkpoint: command.checkpoint.trim(),
        scannedAt: command.scannedAt,
        notes: command.notes ?? null,
        photoUrl: command.photoUrl ?? null,
      },
    });

    return { recorded: true, replayed: false, patrolId: created.id };
  }

  async listPatrols(societyId: string): Promise<PatrolRecord[]> {
    return this.client.guardPatrol.findMany({
      where: { societyId },
      orderBy: { scannedAt: "desc" },
    });
  }

  private async requireVisitor(societyId: string, visitorId: string): Promise<VisitorRecord> {
    const visitor = await this.client.visitor.findUnique({ where: { id: visitorId } });

    if (!visitor || visitor.societyId !== societyId) {
      throw new Error(`Visitor ${visitorId} does not exist in society ${societyId}.`);
    }

    return visitor;
  }
}
