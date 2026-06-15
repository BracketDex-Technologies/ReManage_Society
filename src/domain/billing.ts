import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureUnitsForSociety } from "./unit-migration";

type BillingOccupancy = {
  id: string;
  relationshipType: string;
  billingResponsibility: string;
  isPrimaryOccupant: boolean;
  person: {
    id: string;
    name: string;
    phone: string | null;
    users: Array<{ id: string; name: string; email: string; phone: string | null; role: string }>;
  };
};

function relationshipLabel(relationshipType: string) {
  if (relationshipType === "TENANT") return "Tenant";
  if (relationshipType === "CO_OWNER") return "Co-owner";
  return "Owner";
}

function pickBillingOccupancies(occupancies: BillingOccupancy[]) {
  const tenantPayers = occupancies.filter(
    (occupancy) => occupancy.relationshipType === "TENANT" && occupancy.billingResponsibility === "TENANT"
  );
  if (tenantPayers.length) return tenantPayers;

  const ownerPayers = occupancies.filter((occupancy) =>
    ["OWNER", "CO_OWNER"].includes(occupancy.relationshipType)
  );
  if (ownerPayers.length) {
    const primaryOwner = ownerPayers.find((occupancy) => occupancy.isPrimaryOccupant);
    return primaryOwner ? [primaryOwner] : [ownerPayers[0]];
  }

  const tenantFallback = occupancies.find((occupancy) => occupancy.relationshipType === "TENANT");
  return tenantFallback ? [tenantFallback] : [];
}

export type BillingTarget = {
  flatId: string;
  unitId: string;
  flatNumber: string;
  wing: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  privateMonthlyRent: number | null;
  billingResponsibility: string;
  payerName: string;
  payerRole: string;
  payerPhone: string | null;
  payerEmail: string | null;
  userIds: string[];
};

export async function getBillingTargetsForSociety(societyId: string): Promise<BillingTarget[]> {
  await ensureUnitsForSociety(societyId);

  const units = await prisma.unit.findMany({
    where: {
      societyId,
      isActive: true,
      billingStatus: "ACTIVE",
      legacyFlatId: { not: null },
      occupancies: {
        some: {
          isActive: true,
          occupancyStatus: "ACTIVE",
          relationshipType: { in: ["OWNER", "CO_OWNER", "TENANT"] },
        },
      },
    },
    include: {
      legacyFlat: {
        include: {
          tenants: {
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          users: {
            where: { role: { in: ["member", "tenant"] } },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      },
      occupancies: {
        where: {
          isActive: true,
          occupancyStatus: "ACTIVE",
          relationshipType: { in: ["OWNER", "CO_OWNER", "TENANT"] },
        },
        include: {
          person: {
            include: {
              users: {
                where: { role: { in: ["member", "tenant"] } },
                select: { id: true, name: true, email: true, phone: true, role: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ wing: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
  });

  return units.flatMap((unit) => {
    if (!unit.legacyFlatId) return [];
    const payers = pickBillingOccupancies(unit.occupancies);
    if (!payers.length) return [];
    const owner = unit.occupancies.find((occupancy) => ["OWNER", "CO_OWNER"].includes(occupancy.relationshipType));
    const tenant = unit.occupancies.find((occupancy) => occupancy.relationshipType === "TENANT");
    const tenantRecord = unit.legacyFlat?.tenants[0] || null;

    return payers.map((payer) => {
      const userIds = payer.person.users.map((user) => user.id);
      const fallbackUsers =
        userIds.length === 0
          ? unit.legacyFlat?.users.filter((user) =>
              payer.relationshipType === "TENANT" ? user.role === "tenant" : user.role === "member"
            ) || []
          : [];
      const users = userIds.length ? payer.person.users : fallbackUsers;
      return {
        flatId: unit.legacyFlatId!,
        unitId: unit.id,
        flatNumber: unit.flatNumber,
        wing: unit.wing,
        ownerName: owner?.person.name || unit.legacyFlat?.ownerName || null,
        ownerPhone: owner?.person.phone || unit.legacyFlat?.contact || null,
        ownerEmail: owner?.person.users[0]?.email || unit.legacyFlat?.email || null,
        tenantName: tenant?.person.name || unit.legacyFlat?.tenantName || null,
        tenantPhone: tenant?.person.phone || null,
        privateMonthlyRent: tenantRecord?.monthlyRent || null,
        billingResponsibility: payer.billingResponsibility,
        payerName: payer.person.name,
        payerRole: relationshipLabel(payer.relationshipType),
        payerPhone: payer.person.phone || users[0]?.phone || null,
        payerEmail: users[0]?.email || null,
        userIds: users.map((user) => user.id),
      };
    });
  });
}

export function targetsByFlatId(targets: BillingTarget[]) {
  return new Map(targets.map((target) => [target.flatId, target]));
}
