import { describe, expect, it } from "vitest";
import { AmenityRepository, type AmenityPersistenceClient } from "./amenity.repository.ts";

function createClient(
  options: {
    policy?: Partial<{
      bookingWindowDays: number;
      maxHoursPerBooking: number;
      cancellationCutoffHours: number;
      requiresApproval: boolean;
    }>;
    blackout?: boolean;
    overlappingConfirmed?: boolean;
    capacity?: number | null;
    bookingDate?: Date;
    bookingStartTime?: string;
  } = {},
) {
  const log: string[] = [];
  const policy = options.policy
    ? {
        id: "policy_1",
        bookingWindowDays: options.policy.bookingWindowDays ?? 30,
        maxHoursPerBooking: options.policy.maxHoursPerBooking ?? 2,
        cooldownHours: 0,
        cancellationCutoffHours: options.policy.cancellationCutoffHours ?? 24,
        requiresApproval: options.policy.requiresApproval ?? false,
      }
    : null;

  const client: AmenityPersistenceClient & { log: string[] } = {
    log,
    amenity: {
      create: async () => ({ id: "amenity_1" }),
      findMany: async () => [{ id: "amenity_1" }],
    },
    amenityPolicy: {
      findFirst: async () => policy,
      create: async () => ({ id: "policy_1" }),
      update: async () => ({ id: "policy_1" }),
    },
    amenitySchedule: {
      create: async () => ({ id: "schedule_1" }),
      findMany: async () =>
        options.blackout ? [{ startTime: "10:00", endTime: "12:00", scheduleType: "BLACKOUT" }] : [],
    },
    facility: {
      findUnique: async () => ({
        id: "facility_1",
        societyId: "society_a",
        ratePerHour: 150,
        capacity: options.capacity === undefined ? 1 : options.capacity,
      }),
    },
    facilityBooking: {
      findUnique: async () => ({
        id: "booking_1",
        societyId: "society_a",
        facilityId: "facility_1",
        amenityId: "amenity_1",
        date: options.bookingDate ?? new Date("2026-06-10T00:00:00.000Z"),
        startTime: options.bookingStartTime ?? "09:00",
        endTime: "11:00",
        status: "confirmed",
      }),
      findMany: async () =>
        options.overlappingConfirmed
          ? [
              {
                id: "booking_x",
                societyId: "society_a",
                facilityId: "facility_1",
                date: new Date("2026-06-10T00:00:00.000Z"),
                startTime: "09:30",
                endTime: "10:30",
                status: "confirmed",
              },
            ]
          : [],
      create: async () => {
        log.push("booking.create");
        return { id: "booking_1", status: "confirmed", amount: 300 };
      },
      update: async () => {
        log.push("booking.update");
        return { id: "booking_1", status: "cancelled" };
      },
    },
    facilityWaitlist: {
      findFirst: async () => null,
      create: async () => ({ id: "waitlist_1" }),
      findMany: async () => [],
    },
  };

  return client;
}

const baseBooking = {
  societyId: "society_a",
  facilityId: "facility_1",
  amenityId: "amenity_1",
  bookedBy: "resident_1",
  flatNumber: "A-101",
  date: new Date("2026-06-10T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "11:00",
  now: new Date("2026-06-07T08:00:00.000Z"),
  skipDuesEnforcement: true,
};

describe("AmenityRepository", () => {
  it("creates a confirmed booking and computes the amount", async () => {
    const client = createClient({ policy: {} });
    const repository = new AmenityRepository(client);

    await expect(repository.createBooking(baseBooking)).resolves.toEqual({
      booked: true,
      bookingId: "booking_1",
      status: "confirmed",
      amount: 300,
    });
  });

  it("marks a booking pending when policy requires approval", async () => {
    const client = createClient({ policy: { requiresApproval: true } });
    const repository = new AmenityRepository(client);

    await expect(repository.createBooking(baseBooking)).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects a booking that overlaps a blackout window", async () => {
    const client = createClient({ policy: {}, blackout: true });
    const repository = new AmenityRepository(client);

    await expect(repository.createBooking(baseBooking)).rejects.toThrow(/blackout/i);
  });

  it("rejects a booking when the facility is fully booked", async () => {
    const client = createClient({ policy: {}, overlappingConfirmed: true, capacity: 1 });
    const repository = new AmenityRepository(client);

    await expect(repository.createBooking(baseBooking)).rejects.toThrow(/fully booked/i);
  });

  it("cancels a booking inside the cutoff window", async () => {
    const client = createClient({ policy: { cancellationCutoffHours: 24 } });
    const repository = new AmenityRepository(client);

    await expect(
      repository.cancelBooking({
        societyId: "society_a",
        bookingId: "booking_1",
        now: new Date("2026-06-08T08:00:00.000Z"),
      }),
    ).resolves.toEqual({ cancelled: true, bookingId: "booking_1" });
  });

  it("rejects a late cancellation", async () => {
    const client = createClient({ policy: { cancellationCutoffHours: 24 } });
    const repository = new AmenityRepository(client);

    await expect(
      repository.cancelBooking({
        societyId: "society_a",
        bookingId: "booking_1",
        now: new Date("2026-06-10T06:00:00.000Z"),
      }),
    ).rejects.toThrow(/notice/i);
  });

  it("joins the waitlist idempotently", async () => {
    const client = createClient();
    const repository = new AmenityRepository(client);

    await expect(
      repository.joinWaitlist({
        societyId: "society_a",
        facilityId: "facility_1",
        userId: "resident_1",
        flatNumber: "A-101",
        date: new Date("2026-06-10T00:00:00.000Z"),
        startTime: "09:00",
        endTime: "11:00",
        skipDuesEnforcement: true,
      }),
    ).resolves.toMatchObject({ joined: true, replayed: false, waitlistId: "waitlist_1" });
  });
});
