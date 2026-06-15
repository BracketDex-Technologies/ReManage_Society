import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import { assertFlatNumberDuesClear } from "../../../../packages/db/src/dues-enforcement.ts";
import {
  assertCancellationAllowed,
  computeBookingAmount,
  evaluateBookingRequest,
  parseTimeToMinutes,
  type AmenityPolicySnapshot,
} from "../../../../packages/operations-core/src/index.ts";

interface FacilityRecord {
  id: string;
  societyId: string;
  ratePerHour: number;
  capacity?: number | null;
}

interface PolicyRecord extends AmenityPolicySnapshot {
  id: string;
}

interface ScheduleRecord {
  startTime: string;
  endTime: string;
  scheduleType: string;
}

interface BookingRecord {
  id: string;
  societyId: string;
  facilityId: string;
  amenityId?: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
}

const DEFAULT_POLICY: AmenityPolicySnapshot = {
  bookingWindowDays: 30,
  maxHoursPerBooking: 24,
  cooldownHours: 0,
  cancellationCutoffHours: 0,
  requiresApproval: false,
};

export interface AmenityPersistenceClient {
  amenity: {
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(input: Record<string, unknown>): Promise<Array<{ id: string }>>;
  };
  amenityPolicy: {
    findFirst(input: Record<string, unknown>): Promise<PolicyRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  amenitySchedule: {
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(input: Record<string, unknown>): Promise<ScheduleRecord[]>;
  };
  facility: {
    findUnique(input: { where: { id: string } }): Promise<FacilityRecord | null>;
  };
  facilityBooking: {
    findUnique(input: { where: { id: string } }): Promise<BookingRecord | null>;
    findMany(input: Record<string, unknown>): Promise<BookingRecord[]>;
    create(input: { data: Record<string, unknown> }): Promise<{ id: string; status: string; amount: number }>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string; status: string }>;
  };
  facilityWaitlist: {
    findFirst(input: Record<string, unknown>): Promise<{ id: string } | null>;
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(input: Record<string, unknown>): Promise<Array<{ id: string }>>;
  };
}

export interface CreateAmenityCommand {
  societyId: string;
  name: string;
  category?: string;
  capacity?: number;
  ratePerHour?: number;
  rules?: string;
}

export interface UpsertPolicyCommand {
  societyId: string;
  amenityId: string;
  bookingWindowDays?: number;
  maxHoursPerBooking?: number;
  cooldownHours?: number;
  cancellationCutoffHours?: number;
  guestLimit?: number;
  requiresApproval?: boolean;
}

export interface AddScheduleCommand {
  societyId: string;
  amenityId: string;
  startTime: string;
  endTime: string;
  scheduleType?: string;
  dayOfWeek?: number;
  date?: Date;
}

export interface CreateBookingCommand {
  societyId: string;
  facilityId: string;
  amenityId?: string;
  bookedBy: string;
  flatNumber: string;
  personId?: string;
  unitOccupancyId?: string;
  date: Date;
  startTime: string;
  endTime: string;
  purpose?: string;
  now: Date;
  skipDuesEnforcement?: boolean;
}

export interface CancelBookingCommand {
  societyId: string;
  bookingId: string;
  now: Date;
}

export interface JoinWaitlistCommand {
  societyId: string;
  facilityId: string;
  userId: string;
  flatNumber: string;
  date: Date;
  startTime: string;
  endTime: string;
  skipDuesEnforcement?: boolean;
}

@Injectable()
export class AmenityRepository {
  constructor(
    private readonly client: AmenityPersistenceClient = prisma as unknown as AmenityPersistenceClient,
  ) {}

  async createAmenity(command: CreateAmenityCommand): Promise<{ created: true; amenityId: string }> {
    const amenity = await this.client.amenity.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        category: (command.category ?? "GENERAL").toUpperCase(),
        capacity: command.capacity ?? null,
        ratePerHour: command.ratePerHour ?? 0,
        status: "ACTIVE",
        rules: command.rules ?? null,
      },
    });

    return { created: true, amenityId: amenity.id };
  }

  async upsertPolicy(command: UpsertPolicyCommand): Promise<{ upserted: true; policyId: string }> {
    const existing = await this.client.amenityPolicy.findFirst({
      where: { societyId: command.societyId, amenityId: command.amenityId, isActive: true },
    });

    const data = {
      societyId: command.societyId,
      amenityId: command.amenityId,
      bookingWindowDays: command.bookingWindowDays ?? 30,
      maxHoursPerBooking: command.maxHoursPerBooking ?? 2,
      cooldownHours: command.cooldownHours ?? 0,
      cancellationCutoffHours: command.cancellationCutoffHours ?? 0,
      guestLimit: command.guestLimit ?? null,
      requiresApproval: command.requiresApproval ?? false,
      isActive: true,
    };

    if (existing) {
      const updated = await this.client.amenityPolicy.update({ where: { id: existing.id }, data });
      return { upserted: true, policyId: updated.id };
    }

    const created = await this.client.amenityPolicy.create({ data });
    return { upserted: true, policyId: created.id };
  }

  async addSchedule(command: AddScheduleCommand): Promise<{ created: true; scheduleId: string }> {
    parseTimeToMinutes(command.startTime);
    parseTimeToMinutes(command.endTime);

    const schedule = await this.client.amenitySchedule.create({
      data: {
        societyId: command.societyId,
        amenityId: command.amenityId,
        startTime: command.startTime,
        endTime: command.endTime,
        scheduleType: (command.scheduleType ?? "OPEN").toUpperCase(),
        dayOfWeek: command.dayOfWeek ?? null,
        date: command.date ?? null,
        isActive: true,
      },
    });

    return { created: true, scheduleId: schedule.id };
  }

  async createBooking(
    command: CreateBookingCommand,
  ): Promise<{ booked: true; bookingId: string; status: string; amount: number }> {
    const facility = await this.client.facility.findUnique({ where: { id: command.facilityId } });
    if (!facility || facility.societyId !== command.societyId) {
      throw new Error(`Facility ${command.facilityId} does not exist in society ${command.societyId}.`);
    }

    if (!command.skipDuesEnforcement) {
      await assertFlatNumberDuesClear({
        societyId: command.societyId,
        flatNumber: command.flatNumber,
        now: command.now,
        feature: "amenity_booking",
      });
    }

    const policy = await this.resolvePolicy(command.societyId, command.amenityId);
    const blackouts = command.amenityId
      ? (
          await this.client.amenitySchedule.findMany({
            where: {
              societyId: command.societyId,
              amenityId: command.amenityId,
              scheduleType: "BLACKOUT",
              isActive: true,
            },
          })
        ).map((schedule) => ({ startTime: schedule.startTime, endTime: schedule.endTime }))
      : [];

    const evaluation = evaluateBookingRequest({
      bookingDate: command.date,
      startTime: command.startTime,
      endTime: command.endTime,
      now: command.now,
      policy,
      blackouts,
    });

    if (!evaluation.ok) {
      throw new Error(`Booking rejected: ${evaluation.errors.join(" ")}`);
    }

    const capacity = facility.capacity ?? 1;
    const sameDay = await this.client.facilityBooking.findMany({
      where: {
        societyId: command.societyId,
        facilityId: command.facilityId,
        date: command.date,
        status: "confirmed",
      },
    });

    const start = parseTimeToMinutes(command.startTime);
    const end = parseTimeToMinutes(command.endTime);
    const overlapping = sameDay.filter((booking) => {
      const bookingStart = parseTimeToMinutes(booking.startTime);
      const bookingEnd = parseTimeToMinutes(booking.endTime);
      return start < bookingEnd && end > bookingStart;
    });

    if (overlapping.length >= capacity) {
      throw new Error("Facility is fully booked for the requested slot.");
    }

    const amount = computeBookingAmount(evaluation.hours, facility.ratePerHour);
    const status = policy.requiresApproval ? "pending" : "confirmed";

    const booking = await this.client.facilityBooking.create({
      data: {
        societyId: command.societyId,
        facilityId: command.facilityId,
        amenityId: command.amenityId ?? null,
        bookedBy: command.bookedBy,
        flatNumber: command.flatNumber,
        personId: command.personId ?? null,
        unitOccupancyId: command.unitOccupancyId ?? null,
        date: command.date,
        startTime: command.startTime,
        endTime: command.endTime,
        purpose: command.purpose ?? null,
        status,
        amount,
      },
    });

    return { booked: true, bookingId: booking.id, status, amount };
  }

  async cancelBooking(
    command: CancelBookingCommand,
  ): Promise<{ cancelled: true; bookingId: string }> {
    const booking = await this.client.facilityBooking.findUnique({
      where: { id: command.bookingId },
    });
    if (!booking || booking.societyId !== command.societyId) {
      throw new Error(`Booking ${command.bookingId} does not exist in society ${command.societyId}.`);
    }

    const policy = await this.resolvePolicy(command.societyId, booking.amenityId ?? undefined);
    const start = new Date(
      Date.UTC(
        booking.date.getUTCFullYear(),
        booking.date.getUTCMonth(),
        booking.date.getUTCDate(),
      ) + parseTimeToMinutes(booking.startTime) * 60_000,
    );

    assertCancellationAllowed({
      start,
      now: command.now,
      cancellationCutoffHours: policy.cancellationCutoffHours,
    });

    const updated = await this.client.facilityBooking.update({
      where: { id: command.bookingId },
      data: { status: "cancelled" },
    });

    return { cancelled: true, bookingId: updated.id };
  }

  async joinWaitlist(
    command: JoinWaitlistCommand,
  ): Promise<{ joined: true; replayed: boolean; waitlistId: string }> {
    if (!command.skipDuesEnforcement) {
      await assertFlatNumberDuesClear({
        societyId: command.societyId,
        flatNumber: command.flatNumber,
        now: new Date(),
        feature: "amenity_booking",
      });
    }

    const existing = await this.client.facilityWaitlist.findFirst({
      where: {
        societyId: command.societyId,
        facilityId: command.facilityId,
        userId: command.userId,
        date: command.date,
        startTime: command.startTime,
        status: "waiting",
      },
    });

    if (existing) {
      return { joined: true, replayed: true, waitlistId: existing.id };
    }

    const entry = await this.client.facilityWaitlist.create({
      data: {
        societyId: command.societyId,
        facilityId: command.facilityId,
        userId: command.userId,
        flatNumber: command.flatNumber,
        date: command.date,
        startTime: command.startTime,
        endTime: command.endTime,
        status: "waiting",
      },
    });

    return { joined: true, replayed: false, waitlistId: entry.id };
  }

  async listBookings(societyId: string, facilityId?: string): Promise<BookingRecord[]> {
    return this.client.facilityBooking.findMany({
      where: { societyId, ...(facilityId ? { facilityId } : {}) },
      orderBy: { date: "desc" },
    });
  }

  private async resolvePolicy(
    societyId: string,
    amenityId?: string,
  ): Promise<AmenityPolicySnapshot> {
    if (!amenityId) {
      return DEFAULT_POLICY;
    }

    const policy = await this.client.amenityPolicy.findFirst({
      where: { societyId, amenityId, isActive: true },
    });

    if (!policy) {
      return DEFAULT_POLICY;
    }

    return {
      bookingWindowDays: policy.bookingWindowDays,
      maxHoursPerBooking: policy.maxHoursPerBooking,
      cooldownHours: policy.cooldownHours,
      cancellationCutoffHours: policy.cancellationCutoffHours,
      requiresApproval: policy.requiresApproval,
    };
  }
}
