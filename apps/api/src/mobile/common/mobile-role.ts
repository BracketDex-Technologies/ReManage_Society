export const MOBILE_ROLES = ["resident", "guard"] as const;
export type MobileRole = (typeof MOBILE_ROLES)[number];
export type MobilePermissionRole = "resident" | "member" | "tenant" | "guard";

export function normalizeMobileRole(value: string): MobileRole | null {
  if (["member", "tenant", "resident"].includes(value)) return "resident";
  if (["guard", "watchman"].includes(value)) return "guard";
  return null;
}

export function defaultMobileRole(roles: readonly MobileRole[]): MobileRole {
  if (roles.includes("resident")) return "resident";
  if (roles.includes("guard")) return "guard";
  throw new Error("At least one approved mobile role is required");
}

export function isPermissionRoleValidForMobileRole(
  role: MobileRole,
  permissionRole: string,
): permissionRole is MobilePermissionRole {
  if (role === "guard") return permissionRole === "guard";
  return ["resident", "member", "tenant"].includes(permissionRole);
}
