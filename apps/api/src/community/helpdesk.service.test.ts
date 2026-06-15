import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { HelpdeskService } from "./helpdesk.service.js";
import type { HelpdeskRepository } from "./helpdesk.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<HelpdeskRepository>) {
  return new HelpdeskService(new SecurityPolicyService(), repository as HelpdeskRepository);
}

describe("HelpdeskService", () => {
  it("lets a resident raise and rate complaints", async () => {
    const service = createService({
      raiseComplaint: vi.fn().mockResolvedValue({ created: true }),
      rateComplaint: vi.fn().mockResolvedValue({ rated: true }),
    });

    await expect(
      service.raiseComplaint(principal(["resident"]), {
        societyId: "society_a",
        flatNumber: "A-101",
        raisedBy: "resident_1",
        title: "Leak",
        description: "Water leak",
      }),
    ).resolves.toMatchObject({ created: true });
    await expect(
      service.rateComplaint(principal(["resident"]), {
        societyId: "society_a",
        complaintId: "complaint_1",
        rating: 5,
      }),
    ).resolves.toMatchObject({ rated: true });
  });

  it("forbids a resident from assigning or escalating", async () => {
    const service = createService({ assignComplaint: vi.fn(), escalateComplaint: vi.fn() });

    await expect(
      service.assignComplaint(principal(["resident"]), {
        societyId: "society_a",
        complaintId: "complaint_1",
        assignedTo: "vendor_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.escalateComplaint(principal(["resident"]), {
        societyId: "society_a",
        complaintId: "complaint_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets committee manage complaints without MFA", async () => {
    const service = createService({
      assignComplaint: vi.fn().mockResolvedValue({ assigned: true }),
      transitionComplaint: vi.fn().mockResolvedValue({ transitioned: true }),
    });

    await expect(
      service.assignComplaint(principal(["committee"]), {
        societyId: "society_a",
        complaintId: "complaint_1",
        assignedTo: "vendor_1",
      }),
    ).resolves.toMatchObject({ assigned: true });
    await expect(
      service.transitionComplaint(principal(["committee"]), {
        societyId: "society_a",
        complaintId: "complaint_1",
        action: "resolve",
      }),
    ).resolves.toMatchObject({ transitioned: true });
  });
});
