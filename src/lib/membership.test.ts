import { describe, expect, it } from "vitest";
import { mapProductRoleToPermissionRole, resolveActiveMembership } from "./membership";

describe("mapProductRoleToPermissionRole", () => {
  it("maps each approved product role to its server-side permission role", () => {
    expect(mapProductRoleToPermissionRole("chairman")).toBe("society_admin");
    expect(mapProductRoleToPermissionRole("secretary")).toBe("committee");
    expect(mapProductRoleToPermissionRole("treasurer")).toBe("treasurer");
    expect(mapProductRoleToPermissionRole("guard")).toBe("guard");
    expect(mapProductRoleToPermissionRole("member")).toBe("member");
    expect(mapProductRoleToPermissionRole("tenant")).toBe("tenant");
  });
});

describe("resolveActiveMembership", () => {
  it("returns the active membership and never promotes a pending membership", () => {
    const active = resolveActiveMembership([
      { id: "pending", status: "pending" as const },
      { id: "active", status: "active" as const },
    ]);

    expect(active).toEqual({ id: "active", status: "active" });
    expect(resolveActiveMembership([{ id: "pending", status: "pending" }])).toBeNull();
  });
});
