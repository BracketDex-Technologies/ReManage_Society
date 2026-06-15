import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { StaffService } from "./staff.service.js";
import type { StaffRepository } from "./staff.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<StaffRepository>) {
  return new StaffService(new SecurityPolicyService(), repository as StaffRepository);
}

describe("StaffService", () => {
  it("requires MFA management to register staff", async () => {
    const registerStaff = vi.fn().mockResolvedValue({ registered: true });
    const service = createService({ registerStaff });

    await expect(
      service.registerStaff(principal(["society_admin"], true), {
        societyId: "society_a",
        name: "Sita",
        phone: "9000000000",
        category: "maid",
      }),
    ).resolves.toMatchObject({ registered: true });
  });

  it("blocks staff registration without MFA", async () => {
    const service = createService({ registerStaff: vi.fn() });

    await expect(
      service.registerStaff(principal(["committee"], false), {
        societyId: "society_a",
        name: "Sita",
        phone: "9000000000",
        category: "maid",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a guard mark attendance check-in", async () => {
    const markCheckIn = vi.fn().mockResolvedValue({ recorded: true, replayed: false, attendanceId: "att_1" });
    const service = createService({ markCheckIn });

    await expect(
      service.markCheckIn(principal(["guard"]), {
        societyId: "society_a",
        staffId: "staff_1",
        checkIn: new Date(),
      }),
    ).resolves.toMatchObject({ recorded: true });
  });
});
