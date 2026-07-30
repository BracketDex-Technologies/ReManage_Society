import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-policy.ts";
import type { AuthenticatedPrincipal, PermissionAction } from "./types.ts";

const membershipMfaProtectedActions = [
  "audit:event.read",
  "society:finance.manage",
  "operations:manage",
  "community:document.manage",
  "community:governance.manage",
] satisfies readonly PermissionAction[];

describe("evaluatePermission", () => {
  it.each(membershipMfaProtectedActions)("requires MFA for %s", (action) => {
    const principal: AuthenticatedPrincipal = {
      subject: "admin_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["society_admin"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action,
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: `MFA is required for ${action}`,
    });
  });

  it("allows society admins to manage settings with the password-only session", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "admin_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["society_admin"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action: "society:settings.manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role society_admin",
    });
  });

  it("allows society admins to approve residents and create committee logins with the password-only session", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "chairman_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["society_admin"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    for (const action of [
      "society:core.manage",
      "society:occupancy.manage",
      "society:import.manage",
    ] as const) {
      expect(
        evaluatePermission({
          principal,
          action,
          societyId: "society_a",
        }),
      ).toEqual({
        allowed: true,
        reason: "Allowed by role society_admin",
      });
    }
  });

  it("requires MFA for platform onboarding", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "platform_admin_1",
      memberships: [],
      platformRoles: ["platform_admin"],
    };

    expect(
      evaluatePermission({
        principal,
        action: "society:onboard",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: "MFA is required for society:onboard",
    });
  });

  it("allows MFA-verified society admins to perform protected membership actions", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "admin_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["society_admin"],
          mfaVerified: true,
        },
      ],
      platformRoles: [],
    };

    for (const action of membershipMfaProtectedActions) {
      expect(
        evaluatePermission({
          principal,
          action,
          societyId: "society_a",
        }),
      ).toEqual({
        allowed: true,
        reason: "Allowed by role society_admin",
      });
    }
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
