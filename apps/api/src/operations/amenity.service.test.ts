import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { AmenityService } from "./amenity.service.js";
import type { AmenityRepository } from "./amenity.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<AmenityRepository>) {
  return new AmenityService(new SecurityPolicyService(), repository as AmenityRepository);
}

describe("AmenityService", () => {
  it("lets a resident create a booking", async () => {
    const createBooking = vi
      .fn()
      .mockResolvedValue({ booked: true, bookingId: "b1", status: "confirmed", amount: 300 });
    const service = createService({ createBooking });

    await expect(
      service.createBooking(principal(["resident"]), {
        societyId: "society_a",
        facilityId: "facility_1",
        bookedBy: "resident_1",
        flatNumber: "A-101",
        date: new Date("2026-06-10T00:00:00.000Z"),
        startTime: "09:00",
        endTime: "11:00",
        now: new Date("2026-06-07T08:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ booked: true });
  });

  it("requires MFA management to create an amenity", async () => {
    const service = createService({ createAmenity: vi.fn() });

    await expect(
      service.createAmenity(principal(["committee"], false), { societyId: "society_a", name: "Clubhouse" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks a guard from booking amenities", async () => {
    const service = createService({ createBooking: vi.fn() });

    await expect(
      service.createBooking(principal(["guard"]), {
        societyId: "society_a",
        facilityId: "facility_1",
        bookedBy: "x",
        flatNumber: "A-101",
        date: new Date(),
        startTime: "09:00",
        endTime: "10:00",
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
