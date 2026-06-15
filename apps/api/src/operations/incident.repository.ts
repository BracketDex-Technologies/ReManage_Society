import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  computeSosEscalation,
  matchBlacklist,
  normalizeIncidentSeverity,
  normalizeIncidentType,
  type BlacklistEntry,
  type SosEscalationPlan,
} from "../../../../packages/operations-core/src/index.ts";

interface IncidentRecord {
  id: string;
  societyId: string;
  severity: string;
  status: string;
}

interface BlacklistRecord extends BlacklistEntry {
  societyId: string;
}

export interface IncidentPersistenceClient {
  gateIncident: {
    findFirst(input: Record<string, unknown>): Promise<IncidentRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<IncidentRecord>;
    findMany(input: Record<string, unknown>): Promise<IncidentRecord[]>;
  };
  blacklist: {
    findFirst(input: Record<string, unknown>): Promise<BlacklistRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<BlacklistRecord>;
    findMany(input: Record<string, unknown>): Promise<BlacklistRecord[]>;
  };
}

export interface ReportIncidentCommand {
  societyId: string;
  guardId?: string;
  type: string;
  description: string;
  severity?: string;
  reportedBy?: string;
  actionTaken?: string;
}

export interface RaiseSosCommand {
  societyId: string;
  reportedBy: string;
  description?: string;
  severity?: string;
  raisedAt: Date;
}

export interface AddBlacklistCommand {
  societyId: string;
  name: string;
  phone?: string;
  reason: string;
  addedBy: string;
}

export interface CheckBlacklistCommand {
  societyId: string;
  name?: string;
  phone?: string;
}

@Injectable()
export class IncidentRepository {
  constructor(
    private readonly client: IncidentPersistenceClient = prisma as unknown as IncidentPersistenceClient,
  ) {}

  async reportIncident(
    command: ReportIncidentCommand,
  ): Promise<{ reported: true; incidentId: string; severity: string }> {
    const type = normalizeIncidentType(command.type);
    const severity = normalizeIncidentSeverity(command.severity);

    const incident = await this.client.gateIncident.create({
      data: {
        societyId: command.societyId,
        guardId: command.guardId ?? null,
        type,
        description: command.description,
        severity,
        reportedBy: command.reportedBy ?? null,
        actionTaken: command.actionTaken ?? null,
        status: "reported",
      },
    });

    return { reported: true, incidentId: incident.id, severity };
  }

  async raiseSos(
    command: RaiseSosCommand,
  ): Promise<{ raised: true; replayed: boolean; incidentId: string; escalation: SosEscalationPlan }> {
    const escalation = computeSosEscalation(command.severity ?? "critical");

    const existing = await this.client.gateIncident.findFirst({
      where: {
        societyId: command.societyId,
        reportedBy: command.reportedBy,
        type: "emergency",
        createdAt: command.raisedAt,
      },
    });

    if (existing) {
      return { raised: true, replayed: true, incidentId: existing.id, escalation };
    }

    const incident = await this.client.gateIncident.create({
      data: {
        societyId: command.societyId,
        type: "emergency",
        description: command.description ?? "SOS raised",
        severity: escalation.severity,
        reportedBy: command.reportedBy,
        status: "reported",
        createdAt: command.raisedAt,
      },
    });

    return { raised: true, replayed: false, incidentId: incident.id, escalation };
  }

  async addBlacklist(
    command: AddBlacklistCommand,
  ): Promise<{ added: true; replayed: boolean; blacklistId: string }> {
    if (command.phone) {
      const existing = await this.client.blacklist.findFirst({
        where: { societyId: command.societyId, phone: command.phone, isActive: true },
      });

      if (existing) {
        return { added: true, replayed: true, blacklistId: existing.id };
      }
    }

    const entry = await this.client.blacklist.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        phone: command.phone ?? null,
        reason: command.reason,
        addedBy: command.addedBy,
        isActive: true,
      },
    });

    return { added: true, replayed: false, blacklistId: entry.id };
  }

  async checkBlacklist(
    command: CheckBlacklistCommand,
  ): Promise<{ flagged: boolean; matches: BlacklistEntry[] }> {
    const entries = await this.client.blacklist.findMany({
      where: { societyId: command.societyId, isActive: true },
    });

    const matches = matchBlacklist({
      entries,
      name: command.name,
      phone: command.phone,
    });

    return { flagged: matches.length > 0, matches };
  }

  async listIncidents(societyId: string, status?: string): Promise<IncidentRecord[]> {
    return this.client.gateIncident.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }
}
