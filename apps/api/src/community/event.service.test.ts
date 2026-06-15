import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { EventService } from "./event.service.js";
import type { EventRepository } from "./event.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<EventRepository>) {
  return new EventService(new SecurityPolicyService(), repository as EventRepository);
}

describe("EventService", () => {
  it("requires MFA governance to create an event", async () => {
    const service = createService({ createEvent: vi.fn() });

    await expect(
      service.createEvent(principal(["committee"], false), {
        societyId: "society_a",
        organizerId: "c1",
        title: "Holi",
        startDate: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident RSVP without MFA", async () => {
    const service = createService({ rsvp: vi.fn().mockResolvedValue({ rsvp: true }) });

    await expect(
      service.rsvp(principal(["resident"]), {
        societyId: "society_a",
        eventId: "event_1",
        userId: "u1",
        response: "attending",
      }),
    ).resolves.toMatchObject({ rsvp: true });
  });

  it("lets anyone with read list events", async () => {
    const service = createService({ listEvents: vi.fn().mockResolvedValue([]) });

    await expect(
      service.listEvents(principal(["guard"]), "society_a"),
    ).resolves.toEqual([]);
  });
});
