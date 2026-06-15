import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureUnitForFlat } from "@/domain/unit-migration";
import { moveOutOccupancy, refreshUnitOccupancyStatus } from "@/domain/occupancy-lifecycle";
import bcrypt from "bcryptjs";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

function generateTemporaryPassword(phone: string) {
  const suffix = String(phone || "").replace(/\D/g, "").slice(-4) || Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Tenant@${suffix}`;
}

function normalizeBillingResponsibility(value: unknown) {
  return String(value || "OWNER").toUpperCase() === "TENANT" ? "TENANT" : "OWNER";
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

const LEGACY_ROUTE = "/api/tenants";
const NEST_GET = "/api/v1/society-core/tenants/list";
const NEST_POST = "/api/v1/society-core/tenants/create";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      where: { societyId: session!.societyId },
      include: {
        flat: {
          select: {
            id: true,
            flatNumber: true,
            wing: true,
            ownerName: true,
            units: {
              include: {
                occupancies: {
                  where: { isActive: true, occupancyStatus: "ACTIVE" },
                  include: { person: { include: { users: { select: { email: true }, take: 1 } } } },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const users = tenants.length
      ? await prisma.user.findMany({
          where: { id: { in: tenants.map((tenant) => tenant.userId).filter(Boolean) as string[] } },
          select: { id: true, email: true },
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return Response.json(tenants.map((tenant) => {
      const user = tenant.userId ? usersById.get(tenant.userId) : null;
      const unit = tenant.flat.units[0];
      const owner = unit?.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      const activeTenant = unit?.occupancies.find((item) => item.relationshipType === "TENANT");
      return {
        ...tenant,
        name: activeTenant?.person.name || tenant.name,
        phone: activeTenant?.person.phone || tenant.phone,
        email: user?.email || tenant.email,
        hasLogin: Boolean(tenant.userId && user),
        billingResponsibility: activeTenant?.billingResponsibility || "OWNER",
        status: tenant.status.toLowerCase(),
        flat: {
          id: tenant.flat.id,
          flatNumber: tenant.flat.flatNumber,
          wing: tenant.flat.wing,
          ownerName: owner?.person.name || tenant.flat.ownerName || "Owner not linked",
          ownerPhone: owner?.person.phone || null,
          ownerEmail: owner?.person.users[0]?.email || null,
          ownerLinked: Boolean(owner || tenant.flat.ownerName),
        },
      };
    }));
  } catch {
    return Response.json({ error: "Failed to fetch tenants" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flatId, name, phone, email, password, idProofType, leaseStart, leaseEnd, monthlyRent, billingResponsibility } =
      await request.json();

    if (!flatId || !name || !phone || !leaseStart) {
      return Response.json({ error: "Flat, name, phone and lease start date required" }, { status: 400 });
    }

    const flat = await prisma.flat.findFirst({
      where: { id: flatId, societyId: session!.societyId },
    });

    if (!flat) {
      return Response.json({ error: "Flat not found" }, { status: 404 });
    }

    const unit = await ensureUnitForFlat(flat);
    const existingTenantOccupancy = await prisma.unitOccupancy.findFirst({
      where: {
        societyId: session.societyId,
        unitId: unit.id,
        relationshipType: "TENANT",
        isActive: true,
        occupancyStatus: "ACTIVE",
      },
      include: { person: true },
    });

    if (existingTenantOccupancy) {
      return Response.json(
        { error: `Flat ${flat.flatNumber} already has active tenant ${existingTenantOccupancy.person.name}` },
        { status: 400 }
      );
    }

    const status = ["chairman", "secretary"].includes(session.role) ? "active" : "pending";
    const leaseStartDate = new Date(leaseStart);
    const leaseEndDate = leaseEnd ? new Date(leaseEnd) : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : "";
    const temporaryPassword = cleanEmail ? String(password || generateTemporaryPassword(phone)) : "";
    const maintenancePayer = normalizeBillingResponsibility(billingResponsibility);

    if (cleanEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) {
        return Response.json({ error: "A user with this email already exists" }, { status: 400 });
      }
    }

    const tenant = await prisma.$transaction(async (tx) => {
      let tenantUserId: string | null = null;
      let personId: string | null = null;

      const createdTenant = await tx.tenant.create({
        data: {
          flatId,
          societyId: session.societyId,
          name,
          phone,
          email: cleanEmail || null,
          idProofType: idProofType || null,
          leaseStart: leaseStartDate,
          leaseEnd: leaseEndDate,
          monthlyRent: monthlyRent ? parseFloat(monthlyRent) : null,
          registeredBy: session.userId,
          status,
          userId: tenantUserId,
        },
        include: {
          flat: { select: { flatNumber: true, wing: true } },
        },
      });

      if (status === "active") {
        const person = await tx.person.create({
          data: {
            societyId: session.societyId,
            name,
            phone,
          },
        });
        personId = person.id;

        if (cleanEmail) {
          const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
          const user = await tx.user.create({
            data: {
              societyId: session.societyId,
              flatId,
              personId,
              name,
              email: cleanEmail,
              password: hashedPassword,
              phone,
              role: "tenant",
            },
          });
          tenantUserId = user.id;

          await tx.tenant.update({
            where: { id: createdTenant.id },
            data: { userId: tenantUserId },
          });
        }

        await tx.unitOccupancy.create({
          data: {
            societyId: session.societyId,
            unitId: unit.id,
            personId: person.id,
            relationshipType: "TENANT",
            billingResponsibility: maintenancePayer,
            moveInDate: leaseStartDate,
            agreementEndDate: leaseEndDate,
            isPrimaryOccupant: false,
          },
        });

        await tx.flat.update({
          where: { id: flatId },
          data: { currentOccupant: "tenant", tenantName: name },
        });
      }

      return createdTenant;
    });

    if (status === "active") {
      await refreshUnitOccupancyStatus(unit.id);
    }

    return Response.json({
      ...tenant,
      loginCredentials: cleanEmail
        ? {
            email: cleanEmail,
            password: temporaryPassword,
            note: "Share these temporary credentials privately. Tenant can change password later.",
          }
        : null,
    });
  } catch {
    return Response.json({ error: "Failed to register tenant" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, email, password, action } = body;

    if (action === "update_tenant") {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, societyId: session.societyId },
        include: {
          flat: {
            include: {
              units: {
                include: {
                  occupancies: {
                    where: { isActive: true, occupancyStatus: "ACTIVE" },
                    include: { person: { include: { users: true } } },
                  },
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!tenant) {
        return Response.json({ error: "Tenant not found" }, { status: 404 });
      }

      const unit = tenant.flat.units[0] || await ensureUnitForFlat(tenant.flat);
      const tenantOccupancy = unit.occupancies.find((item) =>
        item.relationshipType === "TENANT" && (item.person.phone === tenant.phone || item.personId === tenant.userId)
      ) || unit.occupancies.find((item) => item.relationshipType === "TENANT");

      if (!tenantOccupancy) {
        return Response.json({ error: "Active tenant occupancy not found" }, { status: 404 });
      }

      const cleanName = String(body.name || tenant.name).trim();
      const cleanPhone = String(body.phone || tenant.phone).trim();
      const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : null;
      const leaseStart = parseOptionalDate(body.leaseStart) || tenant.leaseStart;
      const leaseEnd = parseOptionalDate(body.leaseEnd);
      const monthlyRent = body.monthlyRent === "" || body.monthlyRent == null ? null : Number(body.monthlyRent);
      const maintenancePayer = normalizeBillingResponsibility(body.billingResponsibility || tenantOccupancy.billingResponsibility);

      if (!cleanName || !cleanPhone) {
        return Response.json({ error: "Tenant name and phone are required" }, { status: 400 });
      }

      if (cleanEmail && cleanEmail !== tenant.email) {
        const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (existingUser && existingUser.id !== tenant.userId) {
          return Response.json({ error: "A user with this email already exists" }, { status: 400 });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: tenantOccupancy.personId },
          data: { name: cleanName, phone: cleanPhone },
        });

        if (tenant.userId) {
          await tx.user.update({
            where: { id: tenant.userId },
            data: {
              name: cleanName,
              phone: cleanPhone,
              ...(cleanEmail ? { email: cleanEmail } : {}),
            },
          });
        }

        await tx.unitOccupancy.update({
          where: { id: tenantOccupancy.id },
          data: {
            billingResponsibility: maintenancePayer,
            moveInDate: leaseStart,
            agreementEndDate: leaseEnd,
          },
        });

        await tx.flat.update({
          where: { id: tenant.flatId },
          data: { tenantName: cleanName, currentOccupant: "tenant" },
        });

        return tx.tenant.update({
          where: { id: tenant.id },
          data: {
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            leaseStart,
            leaseEnd,
            monthlyRent: Number.isFinite(monthlyRent) ? monthlyRent : null,
            status: "active",
          },
        });
      });

      await refreshUnitOccupancyStatus(unit.id);
      return Response.json({ tenant: updated });
    }

    if (action === "terminate_tenant") {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, societyId: session.societyId },
        include: {
          flat: {
            include: {
              units: {
                include: {
                  occupancies: {
                    where: { isActive: true, occupancyStatus: "ACTIVE" },
                    include: { person: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!tenant) {
        return Response.json({ error: "Tenant not found" }, { status: 404 });
      }

      const unit = tenant.flat.units[0] || await ensureUnitForFlat(tenant.flat);
      const tenantOccupancy = unit.occupancies.find((item) =>
        item.relationshipType === "TENANT" && item.person.phone === tenant.phone
      ) || unit.occupancies.find((item) => item.relationshipType === "TENANT");

      if (tenantOccupancy) {
        await moveOutOccupancy(tenantOccupancy.id);
      }

      const hasOwner = unit.occupancies.some((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      await prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            status: "terminated",
            leaseEnd: body.moveOutDate ? new Date(body.moveOutDate) : new Date(),
          },
        });
        await tx.flat.update({
          where: { id: tenant.flatId },
          data: {
            tenantName: null,
            currentOccupant: hasOwner || tenant.flat.ownerName ? "owner" : "vacant",
          },
        });
      });

      await refreshUnitOccupancyStatus(unit.id);
      return Response.json({ ok: true, message: "Tenant moved out and occupancy archived" });
    }

    if (action === "update_billing_responsibility") {
      const maintenancePayer = normalizeBillingResponsibility(body.billingResponsibility);
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, societyId: session.societyId },
        include: {
          flat: {
            include: {
              units: {
                include: {
                  occupancies: {
                    where: { isActive: true, occupancyStatus: "ACTIVE" },
                    include: { person: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!tenant) {
        return Response.json({ error: "Tenant not found" }, { status: 404 });
      }

      const unit = tenant.flat.units[0] || await ensureUnitForFlat(tenant.flat);
      const owner = unit.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      if (maintenancePayer === "OWNER" && !owner && !tenant.flat.ownerName) {
        return Response.json(
          { error: "Link the owner first before making owner responsible for society maintenance." },
          { status: 400 }
        );
      }

      const tenantOccupancy = unit.occupancies.find((item) =>
        item.relationshipType === "TENANT" && item.person.phone === tenant.phone
      );
      if (!tenantOccupancy) {
        return Response.json({ error: "Active tenant occupancy not found" }, { status: 404 });
      }

      await prisma.unitOccupancy.update({
        where: { id: tenantOccupancy.id },
        data: { billingResponsibility: maintenancePayer },
      });

      return Response.json({
        ok: true,
        billingResponsibility: maintenancePayer,
        message: maintenancePayer === "OWNER"
          ? "Society maintenance will be billed to the owner/co-owner."
          : "Society maintenance will be billed directly to the tenant.",
      });
    }

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!tenantId || !cleanEmail) {
      return Response.json({ error: "Tenant and login email are required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId: session.societyId },
      include: {
        flat: {
          include: {
            units: {
              include: {
                occupancies: {
                  where: { isActive: true, occupancyStatus: "ACTIVE", relationshipType: "TENANT" },
                  include: { person: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.userId) {
      return Response.json({ error: "Tenant already has login access" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return Response.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const activeOccupancy = tenant.flat.units[0]?.occupancies.find((item) => item.person.phone === tenant.phone);
    const unit = tenant.flat.units[0] || await ensureUnitForFlat(tenant.flat);
    const temporaryPassword = String(password || generateTemporaryPassword(tenant.phone));
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const user = await prisma.$transaction(async (tx) => {
      const person = activeOccupancy?.personId
        ? await tx.person.update({
            where: { id: activeOccupancy.personId },
            data: { name: tenant.name, phone: tenant.phone },
          })
        : await tx.person.create({
            data: { societyId: session.societyId!, name: tenant.name, phone: tenant.phone },
          });

      const createdUser = await tx.user.create({
        data: {
          societyId: session.societyId,
          flatId: tenant.flatId,
          personId: person.id,
          name: tenant.name,
          email: cleanEmail,
          password: hashedPassword,
          phone: tenant.phone,
          role: "tenant",
        },
      });

      if (!activeOccupancy) {
        await tx.unitOccupancy.create({
          data: {
            societyId: session.societyId!,
            unitId: unit.id,
            personId: person.id,
            relationshipType: "TENANT",
            billingResponsibility: "OWNER",
            moveInDate: tenant.leaseStart,
            agreementEndDate: tenant.leaseEnd,
            isPrimaryOccupant: false,
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { userId: createdUser.id, email: cleanEmail, status: "active" },
      });

      return createdUser;
    });

    await refreshUnitOccupancyStatus(unit.id);

    return Response.json({
      userId: user.id,
      loginCredentials: {
        email: cleanEmail,
        password: temporaryPassword,
        note: "Share these temporary credentials privately. Tenant can change password later.",
      },
    });
  } catch (error) {
    console.error("Tenant login creation error:", error);
    return Response.json({ error: "Failed to create tenant login" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/tenants", nestPath: "/api/v1/society-core", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/tenants", nestPath: "/api/v1/society-core", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/tenants", nestPath: "/api/v1/society-core", method: "PATCH" }, legacyPATCH);
