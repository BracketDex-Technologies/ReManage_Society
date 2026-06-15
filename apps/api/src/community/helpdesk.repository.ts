import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyComplaintTransition,
  assertSatisfactionRating,
  computeSlaDueAt,
  defaultSlaHours,
  escalationTarget,
  isSlaBreached,
  nextEscalationLevel,
  normalizeComplaintCategory,
  normalizeComplaintPriority,
  type ComplaintAction,
  type ComplaintStatus,
} from "../../../../packages/community-core/src/index.ts";

interface ComplaintRecord {
  id: string;
  societyId: string;
  flatNumber: string;
  raisedBy: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  resolution: string | null;
  resolvedAt: Date | null;
  assignedTo: string | null;
  assignedAt: Date | null;
  slaHours: number | null;
  escalationLevel: number;
  escalatedAt: Date | null;
  mediaUrls: string | null;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  createdAt: Date;
}

export interface ComplaintPersistenceClient {
  complaint: {
    create(input: { data: Record<string, unknown> }): Promise<ComplaintRecord>;
    findFirst(input: Record<string, unknown>): Promise<ComplaintRecord | null>;
    findMany(input: Record<string, unknown>): Promise<ComplaintRecord[]>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<ComplaintRecord>;
  };
}

export interface RaiseComplaintCommand {
  societyId: string;
  flatNumber: string;
  raisedBy: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  mediaUrls?: string[];
  createdAt?: Date;
}

export interface AssignComplaintCommand {
  societyId: string;
  complaintId: string;
  assignedTo: string;
  slaHours?: number;
  assignedAt?: Date;
}

export interface TransitionComplaintCommand {
  societyId: string;
  complaintId: string;
  action: ComplaintAction;
  resolution?: string;
  at?: Date;
}

export interface EscalateComplaintCommand {
  societyId: string;
  complaintId: string;
  at?: Date;
}

export interface RateComplaintCommand {
  societyId: string;
  complaintId: string;
  rating: number;
  comment?: string;
}

@Injectable()
export class HelpdeskRepository {
  constructor(
    private readonly client: ComplaintPersistenceClient = prisma as unknown as ComplaintPersistenceClient,
  ) {}

  async raiseComplaint(command: RaiseComplaintCommand) {
    const category = normalizeComplaintCategory(command.category);
    const priority = normalizeComplaintPriority(command.priority);
    const createdAt = command.createdAt ?? new Date();
    const slaHours = defaultSlaHours(priority);

    const complaint = await this.client.complaint.create({
      data: {
        societyId: command.societyId,
        flatNumber: command.flatNumber,
        raisedBy: command.raisedBy,
        title: command.title,
        description: command.description,
        category,
        priority,
        status: "open",
        slaHours,
        escalationLevel: 0,
        mediaUrls: command.mediaUrls ? JSON.stringify(command.mediaUrls) : null,
        createdAt,
      },
    });

    return {
      created: true as const,
      complaintId: complaint.id,
      status: "open" as ComplaintStatus,
      priority,
      category,
      slaDueAt: computeSlaDueAt({ createdAt, slaHours }).toISOString(),
    };
  }

  async assignComplaint(command: AssignComplaintCommand) {
    const existing = await this.requireComplaint(command.societyId, command.complaintId);
    const assignedAt = command.assignedAt ?? new Date();

    const updated = await this.client.complaint.update({
      where: { id: existing.id },
      data: {
        assignedTo: command.assignedTo,
        assignedAt,
        ...(command.slaHours ? { slaHours: command.slaHours } : {}),
        ...(existing.status === "open" ? { status: "in_progress" } : {}),
      },
    });

    return { assigned: true as const, complaintId: updated.id, assignedTo: command.assignedTo };
  }

  async transitionComplaint(command: TransitionComplaintCommand) {
    const existing = await this.requireComplaint(command.societyId, command.complaintId);
    const { status } = applyComplaintTransition({
      current: existing.status as ComplaintStatus,
      action: command.action,
    });
    const at = command.at ?? new Date();

    const updated = await this.client.complaint.update({
      where: { id: existing.id },
      data: {
        status,
        ...(status === "resolved"
          ? { resolvedAt: at, ...(command.resolution ? { resolution: command.resolution } : {}) }
          : {}),
        ...(command.action === "reopen" ? { resolvedAt: null } : {}),
      },
    });

    return { transitioned: true as const, complaintId: updated.id, status };
  }

  async escalateComplaint(command: EscalateComplaintCommand) {
    const existing = await this.requireComplaint(command.societyId, command.complaintId);
    const level = nextEscalationLevel(existing.escalationLevel);

    const updated = await this.client.complaint.update({
      where: { id: existing.id },
      data: { escalationLevel: level, escalatedAt: command.at ?? new Date() },
    });

    return {
      escalated: true as const,
      complaintId: updated.id,
      escalationLevel: level,
      target: escalationTarget(level),
    };
  }

  async rateComplaint(command: RateComplaintCommand) {
    const existing = await this.requireComplaint(command.societyId, command.complaintId);
    const rating = assertSatisfactionRating(command.rating);

    if (existing.status !== "resolved" && existing.status !== "closed") {
      throw new Error("Only resolved or closed complaints can be rated.");
    }

    const updated = await this.client.complaint.update({
      where: { id: existing.id },
      data: {
        satisfactionRating: rating,
        ...(command.comment ? { satisfactionComment: command.comment } : {}),
      },
    });

    return { rated: true as const, complaintId: updated.id, rating };
  }

  async listComplaints(
    societyId: string,
    options: { status?: string; now?: Date } = {},
  ) {
    const complaints = await this.client.complaint.findMany({
      where: { societyId, ...(options.status ? { status: options.status } : {}) },
      orderBy: { createdAt: "desc" },
    });

    const now = options.now ?? new Date();

    return complaints.map((complaint) => {
      const slaDueAt =
        complaint.slaHours && complaint.slaHours > 0
          ? computeSlaDueAt({ createdAt: complaint.createdAt, slaHours: complaint.slaHours })
          : null;

      return {
        ...complaint,
        slaDueAt: slaDueAt ? slaDueAt.toISOString() : null,
        slaBreached: slaDueAt
          ? isSlaBreached({ dueAt: slaDueAt, now, status: complaint.status as ComplaintStatus })
          : false,
      };
    });
  }

  private async requireComplaint(societyId: string, complaintId: string): Promise<ComplaintRecord> {
    const existing = await this.client.complaint.findFirst({
      where: { id: complaintId, societyId },
    });

    if (!existing) {
      throw new NotFoundException({ error: "not_found", reason: "Complaint not found" });
    }

    return existing;
  }
}
