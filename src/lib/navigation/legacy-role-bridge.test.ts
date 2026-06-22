import { describe, expect, it } from "vitest";
import {
  buildPersonaNavigation,
  buildPrincipalFromLegacySession,
  mapLegacyRoleToSocietyRoles,
  resolveAllowedActions,
  resolvePersonaFromLegacySession,
} from "./legacy-role-bridge.ts";
import type { UserRole } from "@/lib/role-access";

const SOCIETY_ID = "society_a";

describe("mapLegacyRoleToSocietyRoles", () => {
  const cases: Array<[UserRole, string]> = [
    ["chairman", "society_admin"],
    ["secretary", "committee"],
    ["treasurer", "treasurer"],
    ["member", "resident"],
    ["tenant", "resident"],
    ["guard", "guard"],
    ["watchman", "guard"],
    ["facility_manager", "committee"],
    ["vendor_staff", "resident"],
  ];

  it.each(cases)("maps %s to %s", (legacyRole, societyRole) => {
    expect(mapLegacyRoleToSocietyRoles(legacyRole)).toEqual([societyRole]);
  });

  it("returns an empty list for unknown roles", () => {
    expect(mapLegacyRoleToSocietyRoles("unknown")).toEqual([]);
  });
});

describe("resolveAllowedActions", () => {
  it("allows guards to manage the gate without MFA", () => {
    const principal = buildPrincipalFromLegacySession({
      subject: "guard_1",
      societyId: SOCIETY_ID,
      role: "guard",
      mfaVerified: false,
    });

    const allowed = resolveAllowedActions(principal, SOCIETY_ID);

    expect(allowed.has("operations:gate.manage")).toBe(true);
    expect(allowed.has("operations:manage")).toBe(false);
  });

  it("requires MFA before committee finance management actions", () => {
    const principal = buildPrincipalFromLegacySession({
      subject: "secretary_1",
      societyId: SOCIETY_ID,
      role: "secretary",
      mfaVerified: false,
    });

    const allowed = resolveAllowedActions(principal, SOCIETY_ID);

    expect(allowed.has("society:finance.read")).toBe(true);
    expect(allowed.has("operations:manage")).toBe(false);
    expect(allowed.has("community:document.manage")).toBe(false);
  });

  it("allows MFA-verified committee members to manage sensitive modules", () => {
    const principal = buildPrincipalFromLegacySession({
      subject: "secretary_1",
      societyId: SOCIETY_ID,
      role: "secretary",
      mfaVerified: true,
    });

    const allowed = resolveAllowedActions(principal, SOCIETY_ID);

    expect(allowed.has("operations:manage")).toBe(true);
    expect(allowed.has("community:document.manage")).toBe(true);
  });

  it("supplements resident finance read for my-bills self-service UX", () => {
    const principal = buildPrincipalFromLegacySession({
      subject: "resident_1",
      societyId: SOCIETY_ID,
      role: "member",
    });

    const allowed = resolveAllowedActions(principal, SOCIETY_ID, "member");

    expect(allowed.has("society:finance.read")).toBe(true);
    expect(allowed.has("operations:gate.manage")).toBe(false);
  });

  it("gives treasurers finance read but not gate management", () => {
    const principal = buildPrincipalFromLegacySession({
      subject: "treasurer_1",
      societyId: SOCIETY_ID,
      role: "treasurer",
      mfaVerified: true,
    });

    const allowed = resolveAllowedActions(principal, SOCIETY_ID);

    expect(allowed.has("society:finance.read")).toBe(true);
    expect(allowed.has("operations:gate.manage")).toBe(false);
  });
});

describe("buildPersonaNavigation", () => {
  it("builds guard-first navigation for watchmen", () => {
    const result = buildPersonaNavigation({
      subject: "guard_1",
      societyId: SOCIETY_ID,
      role: "watchman",
    });

    expect(resolvePersonaFromLegacySession({ subject: "guard_1", societyId: SOCIETY_ID, role: "watchman" })).toBe("guard");
    expect(result.navigation.defaultRoute).toBe("/visitors");
    expect(result.quickActions.some((action) => action.id === "log-visitor")).toBe(true);
    expect(result.navigation.sections.some((section) => section.title === "FINANCE")).toBe(false);
  });

  it("builds resident billing quick actions", () => {
    const result = buildPersonaNavigation({
      subject: "resident_1",
      societyId: SOCIETY_ID,
      role: "member",
    });

    expect(result.persona).toBe("resident");
    expect(result.quickActions.some((action) => action.id === "pay-bill")).toBe(true);
    expect(result.navigation.sections.flatMap((section) => section.items).some((item) => item.href === "/my-bills")).toBe(true);
  });

  it("builds platform-admin navigation when platform role is present", () => {
    const result = buildPersonaNavigation({
      subject: "platform_1",
      societyId: SOCIETY_ID,
      role: "member",
      platformRoles: ["platform_admin"],
    });

    expect(result.persona).toBe("platform_admin");
    expect(result.navigation.defaultRoute).toBe("/system");
  });
});
