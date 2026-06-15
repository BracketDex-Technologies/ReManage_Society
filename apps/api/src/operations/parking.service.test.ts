import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { ParkingService } from "./parking.service.js";
import type { ParkingRepository } from "./parking.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<ParkingRepository>) {
  return new ParkingService(new SecurityPolicyService(), repository as ParkingRepository);
}

describe("ParkingService", () => {
  it("lets an MFA admin assign a slot", async () => {
    const assignSlot = vi.fn().mockResolvedValue({ assigned: true, replayed: false, assignmentId: "a1" });
    const service = createService({ assignSlot });

    await expect(
      service.assignSlot(principal(["society_admin"], true), { societyId: "society_a", slotId: "slot_1" }),
    ).resolves.toMatchObject({ assigned: true });
  });

  it("blocks parking management without MFA", async () => {
    const service = createService({ createSlot: vi.fn() });

    await expect(
      service.createSlot(principal(["committee"], false), { societyId: "society_a", slotNumber: "P-1" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident read parking capacity", async () => {
    const capacity = vi.fn().mockResolvedValue({ total: 0, available: 0, assigned: 0, blocked: 0 });
    const service = createService({ capacity });

    await expect(service.capacity(principal(["resident"]), "society_a")).resolves.toMatchObject({
      total: 0,
    });
  });
});
