export const PRODUCT_ROLES = [
  "chairman",
  "secretary",
  "treasurer",
  "guard",
  "member",
  "tenant",
] as const;

export type ProductRole = (typeof PRODUCT_ROLES)[number];

export const PERMISSION_ROLES = [
  "society_admin",
  "committee",
  "treasurer",
  "guard",
  "member",
  "tenant",
] as const;

export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["pending", "active", "rejected"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

const PRODUCT_ROLE_TO_PERMISSION_ROLE: Record<ProductRole, PermissionRole> = {
  chairman: "society_admin",
  secretary: "committee",
  treasurer: "treasurer",
  guard: "guard",
  member: "member",
  tenant: "tenant",
};

export function mapProductRoleToPermissionRole(role: ProductRole): PermissionRole {
  return PRODUCT_ROLE_TO_PERMISSION_ROLE[role];
}

export function resolveActiveMembership<T extends { status: MembershipStatus }>(
  memberships: readonly T[],
): T | null {
  return memberships.find((membership) => membership.status === "active") ?? null;
}
