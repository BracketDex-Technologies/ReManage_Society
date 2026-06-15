import { describe, expect, it } from "vitest";
import { EventRepository, type EventPersistenceClient } from "./event.repository.ts";

interface EventRow {
  id: string;
  societyId: string;
  organizerId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  venue: string | null;
  category: string;
  maxAttendees: number | null;
  status: string;
  createdAt: Date;
}

function createClient(options: {
  event?: Partial<EventRow>;
  existingRsvp?: { id: string; response: string };
  attendingCount?: number;
}) {
  const log: Array<{ op: string; data?: Record<string, unknown> }> = [];
  const event: EventRow | null = options.event
    ? {
        id: "event_1",
        societyId: "society_a",
        organizerId: "c1",
        title: "Holi",
        description: null,
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: null,
        venue: null,
        category: "festival",
        maxAttendees: null,
        status: "upcoming",
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        ...options.event,
      }
    : null;

  const client: EventPersistenceClient & { log: typeof log } = {
    log,
    societyEvent: {
      create: async (input) => {
        log.push({ op: "event.create", data: input.data });
        return { id: "event_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findFirst: async () => event as never,
      findMany: async () => (event ? [event] : []) as never,
      update: async (input) => {
        log.push({ op: "event.update", data: input.data });
        return { ...(event ?? {}), ...(input.data as Record<string, unknown>) } as never;
      },
    },
    eventRsvp: {
      findFirst: async () => (options.existingRsvp ?? null) as never,
      create: async (input) => {
        log.push({ op: "rsvp.create", data: input.data });
        return { id: "rsvp_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      update: async (input) => {
        log.push({ op: "rsvp.update", data: input.data });
        return { id: options.existingRsvp?.id ?? "rsvp_1", ...(input.data as Record<string, unknown>) } as never;
      },
      count: async () => options.attendingCount ?? 0,
      findMany: async () => [],
    },
  };

  return client;
}

describe("EventRepository", () => {
  it("creates an event in upcoming status", async () => {
    const repository = new EventRepository(createClient({ event: undefined }));

    await expect(
      repository.createEvent({
        societyId: "society_a",
        organizerId: "c1",
        title: "Holi",
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        category: "Festival",
      }),
    ).resolves.toMatchObject({ created: true, category: "festival", status: "upcoming" });
  });

  it("starts an upcoming event", async () => {
    const repository = new EventRepository(createClient({ event: { status: "upcoming" } }));

    await expect(
      repository.transitionEvent({ societyId: "society_a", eventId: "event_1", action: "start" }),
    ).resolves.toMatchObject({ status: "ongoing" });
  });

  it("creates a new RSVP", async () => {
    const client = createClient({ event: { status: "upcoming" } });
    const repository = new EventRepository(client);

    await expect(
      repository.rsvp({ societyId: "society_a", eventId: "event_1", userId: "u1", response: "attending" }),
    ).resolves.toMatchObject({ rsvp: true, replayed: false, response: "attending" });
  });

  it("enforces capacity for attending RSVPs", async () => {
    const client = createClient({
      event: { status: "upcoming", maxAttendees: 2 },
      attendingCount: 2,
    });
    const repository = new EventRepository(client);

    await expect(
      repository.rsvp({ societyId: "society_a", eventId: "event_1", userId: "u3", response: "attending" }),
    ).rejects.toThrow(/full/);
  });

  it("updates an existing RSVP and flags replay when unchanged", async () => {
    const client = createClient({
      event: { status: "upcoming" },
      existingRsvp: { id: "rsvp_9", response: "attending" },
    });
    const repository = new EventRepository(client);

    await expect(
      repository.rsvp({ societyId: "society_a", eventId: "event_1", userId: "u1", response: "attending" }),
    ).resolves.toMatchObject({ replayed: true, rsvpId: "rsvp_9" });
  });

  it("rejects RSVP to a cancelled event", async () => {
    const repository = new EventRepository(createClient({ event: { status: "cancelled" } }));

    await expect(
      repository.rsvp({ societyId: "society_a", eventId: "event_1", userId: "u1" }),
    ).rejects.toThrow(/cancelled/);
  });
});
