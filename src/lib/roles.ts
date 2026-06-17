export const COMMITTEE_ROLES = ["chairman", "secretary", "treasurer"] as const;

export const RESIDENT_ROLES = ["member", "tenant"] as const;

export const COMPLAINT_RAISER_ROLES = ["member", "tenant", "guard", "watchman"] as const;

export function isCommitteeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (COMMITTEE_ROLES as readonly string[]).includes(role);
}

export function isResidentRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (RESIDENT_ROLES as readonly string[]).includes(role);
}

/** Residents book amenities, vote, RSVP, and pay dues — not committee logins. */
export function canUseResidentSelfService(role: string | null | undefined): boolean {
  return isResidentRole(role);
}

export const COMMITTEE_SELF_SERVICE_MESSAGE =
  "Committee accounts manage the society. Use a resident login for personal bookings, bills, and marketplace activity.";

export function committeeSelfServiceError(role: string | null | undefined): string | null {
  return isCommitteeRole(role) ? COMMITTEE_SELF_SERVICE_MESSAGE : null;
}

/** Residents and gate staff raise complaints; committee manages the helpdesk. */
export function canRaiseComplaint(role: string | null | undefined): boolean {
  if (!role) return false;
  return (COMPLAINT_RAISER_ROLES as readonly string[]).includes(role);
}
