import "server-only";
import { getSession } from "./auth";
import {
  hasLegacyModulePermission,
  isAdminLegacyRole,
  isCommitteeLegacyRole,
} from "@society/security";

export function hasPermission(role: string, module: string, societyId = "", subject = ""): boolean {
  if (!societyId || !subject) {
    return isAdminLegacyRole(role);
  }

  return hasLegacyModulePermission(role, societyId, subject, module);
}

export function isAdmin(role: string): boolean {
  return isAdminLegacyRole(role);
}

export function isCommittee(role: string): boolean {
  return isCommitteeLegacyRole(role);
}

export async function requirePermission(module: string) {
  const session = await getSession();
  if (!session?.societyId) {
    return { error: "Unauthorized", status: 401, session: null };
  }

  if (
    !hasLegacyModulePermission(
      session.role,
      session.societyId,
      session.userId,
      module,
      session.mfaVerified ?? false,
    )
  ) {
    return { error: "Forbidden: insufficient permissions", status: 403, session: null };
  }

  return { error: null, status: 200, session };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.societyId) {
    return { error: "Unauthorized", status: 401, session: null };
  }
  if (!isAdminLegacyRole(session.role)) {
    return { error: "Admin access required", status: 403, session: null };
  }
  return { error: null, status: 200, session };
}
