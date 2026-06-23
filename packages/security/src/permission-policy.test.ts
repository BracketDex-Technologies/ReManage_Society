import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-policy.ts";
import type { AuthenticatedPrincipal } from "./types.ts";

describe("evaluatePermission", () => {
  it("allows privileged committee actions with a password-authenticated session", () => {
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
      allowed: true,
      reason: "Allowed by role committee",
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

  it("allows committee operations management with a password-authenticated session", () => {
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
      allowed: true,
      reason: "Allowed by role committee",
    });
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

  it("allows governance and document management with a password-authenticated session", () => {
    const committee: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        { societyId: "society_a", roles: ["committee"], mfaVerified: false },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({ principal: committee, action: "community:governance.manage", societyId: "society_a" }),
    ).toEqual({ allowed: true, reason: "Allowed by role committee" });
    expect(
      evaluatePermission({ principal: committee, action: "community:document.manage", societyId: "society_a" }),
    ).toEqual({ allowed: true, reason: "Allowed by role committee" });
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
