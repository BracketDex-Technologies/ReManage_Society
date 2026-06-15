import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  attendanceDedupeKey,
  computeAttendanceDurationMinutes,
  generateStaffEntryCode,
  normalizeAttendanceMethod,
  normalizeStaffCategory,
} from "../../../../packages/operations-core/src/index.ts";

interface StaffRecord {
  id: string;
  societyId: string;
  entryCode?: string | null;
}

interface AttendanceRecord {
  id: string;
  societyId: string;
  staffId: string;
  checkIn: Date;
}

export interface StaffPersistenceClient {
  domesticStaff: {
    findFirst(input: Record<string, unknown>): Promise<StaffRecord | null>;
    findUnique(input: { where: { id: string } }): Promise<StaffRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<StaffRecord>;
    findMany(input: Record<string, unknown>): Promise<StaffRecord[]>;
  };
  staffFlatLink: {
    upsert(input: Record<string, unknown>): Promise<{ id: string }>;
  };
  staffAttendance: {
    findFirst(input: Record<string, unknown>): Promise<AttendanceRecord | null>;
    findUnique(input: { where: { id: string } }): Promise<AttendanceRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<AttendanceRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<AttendanceRecord>;
    findMany(input: Record<string, unknown>): Promise<AttendanceRecord[]>;
  };
}

export interface StaffRegisterCommand {
  societyId: string;
  name: string;
  phone: string;
  category: string;
  photoUrl?: string;
  idProofType?: string;
  idProofUrl?: string;
}

export interface StaffRegisterResult {
  registered: true;
  replayed: boolean;
  staffId: string;
  entryCode: string | null;
}

export interface StaffFlatLinkCommand {
  societyId: string;
  staffId: string;
  flatId: string;
  schedule?: string;
  agreedMonthlyPay?: number;
}

export interface AttendanceCheckInCommand {
  societyId: string;
  staffId: string;
  flatId?: string;
  checkIn: Date;
  markedBy?: string;
  method?: string;
}

export interface AttendanceCheckOutCommand {
  societyId: string;
  attendanceId: string;
  checkOut: Date;
}

@Injectable()
export class StaffRepository {
  constructor(
    private readonly client: StaffPersistenceClient = prisma as unknown as StaffPersistenceClient,
    private readonly entryCodeFactory: () => string = () => generateStaffEntryCode(),
  ) {}

  async registerStaff(command: StaffRegisterCommand): Promise<StaffRegisterResult> {
    const category = normalizeStaffCategory(command.category);

    const existing = await this.client.domesticStaff.findFirst({
      where: { societyId: command.societyId, phone: command.phone },
    });

    if (existing) {
      return {
        registered: true,
        replayed: true,
        staffId: existing.id,
        entryCode: existing.entryCode ?? null,
      };
    }

    const entryCode = this.entryCodeFactory();
    const created = await this.client.domesticStaff.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        phone: command.phone,
        category,
        photoUrl: command.photoUrl ?? null,
        idProofType: command.idProofType ?? null,
        idProofUrl: command.idProofUrl ?? null,
        entryCode,
        isActive: true,
      },
    });

    return { registered: true, replayed: false, staffId: created.id, entryCode };
  }

  async linkStaffToFlat(command: StaffFlatLinkCommand): Promise<{ linked: true; linkId: string }> {
    await this.requireStaff(command.societyId, command.staffId);

    const link = await this.client.staffFlatLink.upsert({
      where: { staffId_flatId: { staffId: command.staffId, flatId: command.flatId } },
      create: {
        staffId: command.staffId,
        flatId: command.flatId,
        schedule: command.schedule ?? null,
        agreedMonthlyPay: command.agreedMonthlyPay ?? null,
        isActive: true,
      },
      update: {
        schedule: command.schedule ?? null,
        agreedMonthlyPay: command.agreedMonthlyPay ?? null,
        isActive: true,
      },
    });

    return { linked: true, linkId: link.id };
  }

  async markCheckIn(
    command: AttendanceCheckInCommand,
  ): Promise<{ recorded: true; replayed: boolean; attendanceId: string }> {
    await this.requireStaff(command.societyId, command.staffId);
    const method = normalizeAttendanceMethod(command.method);
    // Validates the offline-replay dedupe key for the check-in.
    attendanceDedupeKey(command);

    const existing = await this.client.staffAttendance.findFirst({
      where: {
        societyId: command.societyId,
        staffId: command.staffId,
        checkIn: command.checkIn,
      },
    });

    if (existing) {
      return { recorded: true, replayed: true, attendanceId: existing.id };
    }

    const created = await this.client.staffAttendance.create({
      data: {
        societyId: command.societyId,
        staffId: command.staffId,
        flatId: command.flatId ?? null,
        checkIn: command.checkIn,
        markedBy: command.markedBy ?? "system",
        method,
      },
    });

    return { recorded: true, replayed: false, attendanceId: created.id };
  }

  async markCheckOut(
    command: AttendanceCheckOutCommand,
  ): Promise<{ recorded: true; attendanceId: string; durationMinutes: number }> {
    const attendance = await this.client.staffAttendance.findUnique({
      where: { id: command.attendanceId },
    });

    if (!attendance || attendance.societyId !== command.societyId) {
      throw new Error(
        `Attendance ${command.attendanceId} does not exist in society ${command.societyId}.`,
      );
    }

    const durationMinutes = computeAttendanceDurationMinutes(attendance.checkIn, command.checkOut);
    const updated = await this.client.staffAttendance.update({
      where: { id: command.attendanceId },
      data: { checkOut: command.checkOut },
    });

    return { recorded: true, attendanceId: updated.id, durationMinutes };
  }

  async listStaff(societyId: string): Promise<StaffRecord[]> {
    return this.client.domesticStaff.findMany({
      where: { societyId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async listAttendance(societyId: string, staffId?: string): Promise<AttendanceRecord[]> {
    return this.client.staffAttendance.findMany({
      where: { societyId, ...(staffId ? { staffId } : {}) },
      orderBy: { checkIn: "desc" },
    });
  }

  private async requireStaff(societyId: string, staffId: string): Promise<StaffRecord> {
    const staff = await this.client.domesticStaff.findUnique({ where: { id: staffId } });

    if (!staff || staff.societyId !== societyId) {
      throw new Error(`Staff ${staffId} does not exist in society ${societyId}.`);
    }

    return staff;
  }
}
