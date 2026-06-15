import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyEventTransition,
  assertRsvpCapacity,
  normalizeEventCategory,
  normalizeRsvpResponse,
  type EventAction,
  type EventStatus,
} from "../../../../packages/community-core/src/index.ts";

interface EventRecord {
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

interface RsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  response: string;
  createdAt: Date;
}

export interface EventPersistenceClient {
  societyEvent: {
    create(input: { data: Record<string, unknown> }): Promise<EventRecord>;
    findFirst(input: Record<string, unknown>): Promise<EventRecord | null>;
    findMany(input: Record<string, unknown>): Promise<EventRecord[]>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<EventRecord>;
  };
  eventRsvp: {
    findFirst(input: Record<string, unknown>): Promise<RsvpRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<RsvpRecord>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<RsvpRecord>;
    count(input: Record<string, unknown>): Promise<number>;
    findMany(input: Record<string, unknown>): Promise<RsvpRecord[]>;
  };
}

export interface CreateEventCommand {
  societyId: string;
  organizerId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  venue?: string;
  category?: string;
  maxAttendees?: number;
}

export interface TransitionEventCommand {
  societyId: string;
  eventId: string;
  action: EventAction;
}

export interface RsvpCommand {
  societyId: string;
  eventId: string;
  userId: string;
  response?: string;
}

@Injectable()
export class EventRepository {
  constructor(
    private readonly client: EventPersistenceClient = prisma as unknown as EventPersistenceClient,
  ) {}

  async createEvent(command: CreateEventCommand) {
    const category = normalizeEventCategory(command.category);

    const event = await this.client.societyEvent.create({
      data: {
        societyId: command.societyId,
        organizerId: command.organizerId,
        title: command.title,
        description: command.description ?? null,
        startDate: command.startDate,
        endDate: command.endDate ?? null,
        venue: command.venue ?? null,
        category,
        maxAttendees: command.maxAttendees ?? null,
        status: "upcoming",
      },
    });

    return { created: true as const, eventId: event.id, category, status: "upcoming" as EventStatus };
  }

  async transitionEvent(command: TransitionEventCommand) {
    const event = await this.requireEvent(command.societyId, command.eventId);
    const { status } = applyEventTransition({
      current: event.status as EventStatus,
      action: command.action,
    });

    const updated = await this.client.societyEvent.update({
      where: { id: event.id },
      data: { status },
    });

    return { transitioned: true as const, eventId: updated.id, status };
  }

  async rsvp(command: RsvpCommand) {
    const event = await this.requireEvent(command.societyId, command.eventId);

    if (event.status === "cancelled" || event.status === "completed") {
      throw new Error(`Cannot RSVP to a ${event.status} event.`);
    }

    const response = normalizeRsvpResponse(command.response);
    const existing = await this.client.eventRsvp.findFirst({
      where: { eventId: command.eventId, userId: command.userId },
    });

    if (response === "attending") {
      const currentAttending = await this.client.eventRsvp.count({
        where: {
          eventId: command.eventId,
          response: "attending",
          ...(existing ? { NOT: { id: existing.id } } : {}),
        },
      });
      assertRsvpCapacity({
        maxAttendees: event.maxAttendees,
        currentAttending,
        willAttend: true,
      });
    }

    if (existing) {
      const updated = await this.client.eventRsvp.update({
        where: { id: existing.id },
        data: { response },
      });
      return { rsvp: true as const, replayed: existing.response === response, rsvpId: updated.id, response };
    }

    const created = await this.client.eventRsvp.create({
      data: { eventId: command.eventId, userId: command.userId, response },
    });

    return { rsvp: true as const, replayed: false, rsvpId: created.id, response };
  }

  async listEvents(societyId: string, status?: string) {
    return this.client.societyEvent.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { startDate: "asc" },
    });
  }

  async listRsvps(eventId: string) {
    return this.client.eventRsvp.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  }

  private async requireEvent(societyId: string, eventId: string): Promise<EventRecord> {
    const event = await this.client.societyEvent.findFirst({ where: { id: eventId, societyId } });

    if (!event) {
      throw new NotFoundException({ error: "not_found", reason: "Event not found" });
    }

    return event;
  }
}
