export const COMMITTEE_ROLES = ["chairman", "secretary", "treasurer"] as const;

export const COMPLAINT_RAISER_ROLES = ["member", "tenant", "guard", "watchman"] as const;

export function isCommitteeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (COMMITTEE_ROLES as readonly string[]).includes(role);
}

/** Residents and gate staff raise complaints; committee manages the helpdesk. */
export function canRaiseComplaint(role: string | null | undefined): boolean {
  if (!role) return false;
  return (COMPLAINT_RAISER_ROLES as readonly string[]).includes(role);
}
