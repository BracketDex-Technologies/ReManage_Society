import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  assertSlotAssignable,
  normalizeParkingAssignmentType,
  normalizeParkingSlotType,
  summarizeParkingCapacity,
  type ParkingCapacitySummary,
} from "../../../../packages/operations-core/src/index.ts";

interface SlotRecord {
  id: string;
  societyId: string;
  status: string;
  isAssigned: boolean;
}

interface AssignmentRecord {
  id: string;
  societyId: string;
  slotId: string;
  status: string;
}

export interface ParkingPersistenceClient {
  parkingZone: {
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(input: Record<string, unknown>): Promise<Array<{ id: string }>>;
  };
  parkingSlot: {
    findFirst(input: Record<string, unknown>): Promise<SlotRecord | null>;
    findUnique(input: { where: { id: string } }): Promise<SlotRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<SlotRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<SlotRecord>;
    findMany(input: Record<string, unknown>): Promise<SlotRecord[]>;
  };
  parkingAssignment: {
    findFirst(input: Record<string, unknown>): Promise<AssignmentRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<AssignmentRecord>;
    updateMany(input: Record<string, unknown>): Promise<{ count: number }>;
  };
}

export interface CreateZoneCommand {
  societyId: string;
  name: string;
  level?: string;
  wing?: string;
  description?: string;
}

export interface CreateSlotCommand {
  societyId: string;
  slotNumber: string;
  slotType?: string;
  zoneId?: string;
  level?: string;
  wing?: string;
}

export interface AssignSlotCommand {
  societyId: string;
  slotId: string;
  vehicleId?: string;
  unitOccupancyId?: string;
  assignmentType?: string;
  vehicleNo?: string;
  assignedBy?: string;
}

export interface ReleaseSlotCommand {
  societyId: string;
  slotId: string;
}

@Injectable()
export class ParkingRepository {
  constructor(
    private readonly client: ParkingPersistenceClient = prisma as unknown as ParkingPersistenceClient,
  ) {}

  async createZone(command: CreateZoneCommand): Promise<{ created: true; zoneId: string }> {
    const zone = await this.client.parkingZone.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        level: command.level ?? null,
        wing: command.wing ?? null,
        description: command.description ?? null,
        isActive: true,
      },
    });

    return { created: true, zoneId: zone.id };
  }

  async createSlot(
    command: CreateSlotCommand,
  ): Promise<{ created: true; replayed: boolean; slotId: string }> {
    const slotType = normalizeParkingSlotType(command.slotType);

    const existing = await this.client.parkingSlot.findFirst({
      where: { societyId: command.societyId, slotNumber: command.slotNumber },
    });

    if (existing) {
      return { created: true, replayed: true, slotId: existing.id };
    }

    const slot = await this.client.parkingSlot.create({
      data: {
        societyId: command.societyId,
        slotNumber: command.slotNumber,
        slotType,
        zoneId: command.zoneId ?? null,
        level: command.level ?? null,
        wing: command.wing ?? null,
        status: "ACTIVE",
        isAssigned: false,
      },
    });

    return { created: true, replayed: false, slotId: slot.id };
  }

  async assignSlot(
    command: AssignSlotCommand,
  ): Promise<{ assigned: true; replayed: boolean; assignmentId: string }> {
    const assignmentType = normalizeParkingAssignmentType(command.assignmentType);
    const slot = await this.requireSlot(command.societyId, command.slotId);

    if (command.vehicleId) {
      const existing = await this.client.parkingAssignment.findFirst({
        where: {
          societyId: command.societyId,
          slotId: command.slotId,
          vehicleId: command.vehicleId,
          status: "ACTIVE",
        },
      });

      if (existing) {
        return { assigned: true, replayed: true, assignmentId: existing.id };
      }
    }

    assertSlotAssignable(slot);

    const assignment = await this.client.parkingAssignment.create({
      data: {
        societyId: command.societyId,
        slotId: command.slotId,
        vehicleId: command.vehicleId ?? null,
        unitOccupancyId: command.unitOccupancyId ?? null,
        assignmentType,
        status: "ACTIVE",
        assignedBy: command.assignedBy ?? null,
      },
    });

    await this.client.parkingSlot.update({
      where: { id: command.slotId },
      data: { isAssigned: true, vehicleNo: command.vehicleNo ?? null },
    });

    return { assigned: true, replayed: false, assignmentId: assignment.id };
  }

  async releaseSlot(command: ReleaseSlotCommand): Promise<{ released: true; slotId: string }> {
    await this.requireSlot(command.societyId, command.slotId);

    await this.client.parkingAssignment.updateMany({
      where: { societyId: command.societyId, slotId: command.slotId, status: "ACTIVE" },
      data: { status: "ARCHIVED", endDate: new Date(), archivedAt: new Date() },
    });

    await this.client.parkingSlot.update({
      where: { id: command.slotId },
      data: { isAssigned: false, vehicleNo: null },
    });

    return { released: true, slotId: command.slotId };
  }

  async listSlots(societyId: string, zoneId?: string): Promise<SlotRecord[]> {
    return this.client.parkingSlot.findMany({
      where: { societyId, ...(zoneId ? { zoneId } : {}) },
      orderBy: { slotNumber: "asc" },
    });
  }

  async capacity(societyId: string, zoneId?: string): Promise<ParkingCapacitySummary> {
    const slots = await this.listSlots(societyId, zoneId);
    return summarizeParkingCapacity(slots);
  }

  private async requireSlot(societyId: string, slotId: string): Promise<SlotRecord> {
    const slot = await this.client.parkingSlot.findUnique({ where: { id: slotId } });

    if (!slot || slot.societyId !== societyId) {
      throw new Error(`Parking slot ${slotId} does not exist in society ${societyId}.`);
    }

    return slot;
  }
}
