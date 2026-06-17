import type { SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isCommitteeRole } from "@/lib/roles";
import { getResidentFlatForSession, isResidentRole } from "@/lib/resident-flat";

export function normalizeFlatKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export type ComplaintListScope =
  | { kind: "all" }
  | { kind: "none"; reason: "no_flat" }
  | { kind: "flat"; flatNumber: string; flatKey: string }
  | { kind: "raisedBy"; raisedBy: string };

export async function resolveComplaintListScope(session: SessionPayload): Promise<ComplaintListScope> {
  if (isCommitteeRole(session.role)) {
    return { kind: "all" };
  }

  const flat = await getResidentFlatForSession(session);
  if (flat?.flatNumber) {
    return {
      kind: "flat",
      flatNumber: flat.flatNumber,
      flatKey: normalizeFlatKey(flat.flatNumber),
    };
  }

  if (isResidentRole(session.role)) {
    return { kind: "none", reason: "no_flat" };
  }

  return { kind: "raisedBy", raisedBy: session.name };
}

export function filterComplaintsByScope<T extends { flatNumber: string; raisedBy: string }>(
  complaints: T[],
  scope: ComplaintListScope,
): T[] {
  if (scope.kind === "all") return complaints;
  if (scope.kind === "none") return [];
  if (scope.kind === "raisedBy") {
    const name = scope.raisedBy.trim().toLowerCase();
    return complaints.filter((c) => c.raisedBy.trim().toLowerCase() === name);
  }

  const flatKey = scope.flatKey;
  return complaints.filter((c) => normalizeFlatKey(c.flatNumber) === flatKey);
}

export async function buildComplaintWhereClause(session: SessionPayload) {
  const scope = await resolveComplaintListScope(session);
  const base = { societyId: session.societyId };

  if (scope.kind === "all") return base;
  if (scope.kind === "none") {
    return { ...base, id: { in: [] as string[] } };
  }

  if (scope.kind === "raisedBy") {
    return {
      ...base,
      raisedBy: { equals: scope.raisedBy, mode: "insensitive" as const },
    };
  }

  const flats = await prisma.flat.findMany({
    where: { societyId: session.societyId, isActive: true },
    select: { flatNumber: true },
  });

  const matchingFlatNumbers = flats
    .filter((f) => normalizeFlatKey(f.flatNumber) === scope.flatKey)
    .map((f) => f.flatNumber);

  const flatNumbers = matchingFlatNumbers.length > 0 ? matchingFlatNumbers : [scope.flatNumber];

  return {
    ...base,
    flatNumber: { in: flatNumbers },
  };
}

export async function assertComplaintFlatAccess(
  session: SessionPayload,
  flatNumber: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (isCommitteeRole(session.role)) return { ok: true };

  const scope = await resolveComplaintListScope(session);
  if (scope.kind === "none") {
    return { ok: false, error: "No flat linked to your account", status: 403 };
  }
  if (scope.kind === "raisedBy") {
    return { ok: true };
  }
  if (scope.kind === "flat" && normalizeFlatKey(flatNumber) === scope.flatKey) {
    return { ok: true };
  }

  return { ok: false, error: "You can only raise complaints for your own flat", status: 403 };
}
