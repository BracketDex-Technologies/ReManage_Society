export const UNIT_TYPES = [
  "1RK",
  "1BHK",
  "2BHK",
  "3BHK",
  "SHOP",
  "OFFICE",
  "PENTHOUSE",
  "VILLA",
] as const;

export const USAGE_TYPES = ["RESIDENTIAL", "COMMERCIAL", "MIXED_USE"] as const;

export const UNIT_OCCUPANCY_STATUSES = [
  "OWNER_OCCUPIED",
  "TENANT_OCCUPIED",
  "VACANT",
  "LOCKED",
  "UNDER_RENOVATION",
] as const;

export const OWNERSHIP_STATUSES = [
  "FREEHOLD",
  "JOINT_OWNERSHIP",
  "DEVELOPER_OWNED",
  "UNDER_DISPUTE",
] as const;

export const RELATIONSHIP_TYPES = [
  "OWNER",
  "TENANT",
  "CO_OWNER",
  "FAMILY_MEMBER",
  "CAREGIVER",
  "COMMERCIAL_OPERATOR",
] as const;

export const BILLING_RESPONSIBILITIES = ["OWNER", "TENANT", "SPLIT", "CUSTOM"] as const;

export function occupancyStatusForRelationships(relationships: string[]) {
  if (relationships.includes("TENANT")) return "TENANT_OCCUPIED";
  if (relationships.some((role) => ["OWNER", "CO_OWNER", "FAMILY_MEMBER"].includes(role))) {
    return "OWNER_OCCUPIED";
  }
  return "VACANT";
}

export function isBillableOccupancy(status: string, billingStatus = "ACTIVE") {
  return billingStatus === "ACTIVE" && !["VACANT", "LOCKED"].includes(status);
}
