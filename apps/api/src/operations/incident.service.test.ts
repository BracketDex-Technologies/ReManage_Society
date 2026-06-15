import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { NotificationFoundationService } from "../security/notification-foundation.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { IncidentService } from "./incident.service.js";
import type { IncidentRepository } from "./incident.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<IncidentRepository>) {
  return new IncidentService(
    new SecurityPolicyService(),
    new NotificationFoundationService({ now: () => "2026-06-07T09:00:00.000Z" }),
    repository as IncidentRepository,
  );
}

describe("IncidentService", () => {
  it("lets a resident raise an SOS and fans out notifications per tier", async () => {
    const raiseSos = vi.fn().mockResolvedValue({
      raised: true,
      replayed: false,
      incidentId: "incident_1",
      escalation: {
        severity: "critical",
        tiers: ["guard", "committee", "society_admin", "emergency_services"],
        acknowledgementRequired: true,
      },
    });
    const service = createService({ raiseSos });

    const result = await service.raiseSos(principal(["resident"]), {
      societyId: "society_a",
      reportedBy: "resident_1",
      raisedAt: new Date("2026-06-07T09:00:00.000Z"),
    });

    expect(result.notifications).toHaveLength(4);
    expect(result.notifications[0]).toMatchObject({ template: "sos-alert" });
  });

  it("lets a guard report an incident", async () => {
    const reportIncident = vi
      .fn()
      .mockResolvedValue({ reported: true, incidentId: "incident_1", severity: "high" });
    const service = createService({ reportIncident });

    await expect(
      service.reportIncident(principal(["guard"]), {
        societyId: "society_a",
        type: "theft",
        description: "Bag stolen",
      }),
    ).resolves.toMatchObject({ reported: true });
  });

  it("requires MFA management to add a blacklist entry", async () => {
    const service = createService({ addBlacklist: vi.fn() });

    await expect(
      service.addBlacklist(principal(["committee"], false), {
        societyId: "society_a",
        name: "Bad Actor",
        reason: "Theft",
        addedBy: "committee_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
