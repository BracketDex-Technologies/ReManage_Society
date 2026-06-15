import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { evaluatePermission } from "./permission-policy.ts";
import type { AuthenticatedPrincipal } from "./types.ts";

describe("evaluatePermission", () => {
  const previousMfaEnforcement = process.env.MFA_ENFORCEMENT_ENABLED;

  beforeAll(() => {
    process.env.MFA_ENFORCEMENT_ENABLED = "true";
  });

  afterAll(() => {
    if (previousMfaEnforcement === undefined) {
      delete process.env.MFA_ENFORCEMENT_ENABLED;
    } else {
      process.env.MFA_ENFORCEMENT_ENABLED = previousMfaEnforcement;
    }
  });
  it("requires MFA for privileged committee actions", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["committee"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action: "audit:event.read",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: "MFA is required for audit:event.read",
    });
  });

  it("allows treasurers to read audit events only inside their own society", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "treasurer_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["treasurer"],
          mfaVerified: true,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action: "audit:event.read",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role treasurer",
    });

    expect(
      evaluatePermission({
        principal,
        action: "audit:event.read",
        societyId: "society_b",
      }),
    ).toEqual({
      allowed: false,
      reason: "Principal treasurer_1 is not a member of society society_b",
    });
  });

  it("lets guards run gate operations without MFA", () => {
    const guard: AuthenticatedPrincipal = {
      subject: "guard_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["guard"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({ principal: guard, action: "operations:gate.manage", societyId: "society_a" }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission({ principal: guard, action: "operations:read", societyId: "society_a" }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission({ principal: guard, action: "operations:sos.raise", societyId: "society_a" }),
    ).toMatchObject({ allowed: true });
  });

  it("lets residents respond to their visitors and raise SOS but not manage operations", () => {
    const resident: AuthenticatedPrincipal = {
      subject: "resident_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["resident"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal: resident,
        action: "operations:visitor.respond",
        societyId: "society_a",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission({
        principal: resident,
        action: "operations:booking.manage",
        societyId: "society_a",
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission({
        principal: resident,
        action: "operations:manage",
        societyId: "society_a",
      }),
    ).toMatchObject({ allowed: false });
  });

  it("requires MFA for sensitive operations management", () => {
    const committee: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["committee"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal: committee,
        action: "operations:manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: "MFA is required for operations:manage",
    });

    expect(
      evaluatePermission({
        principal: { ...committee, memberships: [{ societyId: "society_a", roles: ["committee"], mfaVerified: true }] },
        action: "operations:manage",
        societyId: "society_a",
      }),
    ).toMatchObject({ allowed: true });
  });

  it("lets residents read, post, vote, rsvp, and raise complaints without MFA", () => {
    const resident: AuthenticatedPrincipal = {
      subject: "resident_1",
      memberships: [
        { societyId: "society_a", roles: ["resident"], mfaVerified: false },
      ],
      platformRoles: [],
    };

    for (const action of [
      "community:read",
      "community:post",
      "community:vote.cast",
      "community:rsvp.manage",
      "community:helpdesk.respond",
    ] as const) {
      expect(
        evaluatePermission({ principal: resident, action, societyId: "society_a" }),
      ).toMatchObject({ allowed: true });
    }

    expect(
      evaluatePermission({ principal: resident, action: "community:moderate", societyId: "society_a" }),
    ).toMatchObject({ allowed: false });
    expect(
      evaluatePermission({ principal: resident, action: "community:notice.manage", societyId: "society_a" }),
    ).toMatchObject({ allowed: false });
  });

  it("lets committee moderate and manage notices/helpdesk without MFA", () => {
    const committee: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        { societyId: "society_a", roles: ["committee"], mfaVerified: false },
      ],
      platformRoles: [],
    };

    for (const action of [
      "community:notice.manage",
      "community:helpdesk.manage",
      "community:moderate",
    ] as const) {
      expect(
        evaluatePermission({ principal: committee, action, societyId: "society_a" }),
      ).toMatchObject({ allowed: true });
    }
  });

  it("requires MFA for governance and document management", () => {
    const committee: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        { societyId: "society_a", roles: ["committee"], mfaVerified: false },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({ principal: committee, action: "community:governance.manage", societyId: "society_a" }),
    ).toEqual({ allowed: false, reason: "MFA is required for community:governance.manage" });
    expect(
      evaluatePermission({ principal: committee, action: "community:document.manage", societyId: "society_a" }),
    ).toEqual({ allowed: false, reason: "MFA is required for community:document.manage" });

    const mfaCommittee: AuthenticatedPrincipal = {
      ...committee,
      memberships: [{ societyId: "society_a", roles: ["committee"], mfaVerified: true }],
    };

    expect(
      evaluatePermission({ principal: mfaCommittee, action: "community:governance.manage", societyId: "society_a" }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission({ principal: mfaCommittee, action: "community:document.manage", societyId: "society_a" }),
    ).toMatchObject({ allowed: true });
  });

  it("does not grant gate operations to a plain guard for management actions", () => {
    const guard: AuthenticatedPrincipal = {
      subject: "guard_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["guard"],
          mfaVerified: true,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({ principal: guard, action: "operations:manage", societyId: "society_a" }),
    ).toMatchObject({ allowed: false });
    expect(
      evaluatePermission({
        principal: guard,
        action: "operations:visitor.respond",
        societyId: "society_a",
      }),
    ).toMatchObject({ allowed: false });
  });
});
