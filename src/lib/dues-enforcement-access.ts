import { isCommitteeRole } from "@/lib/roles";

export function shouldSkipDuesEnforcement(role: string | null | undefined): boolean {
  return isCommitteeRole(role);
}
