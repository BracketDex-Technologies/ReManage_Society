import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const OWNER_RELATIONSHIPS = ["OWNER", "CO_OWNER"];

function parseAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parsePeriod(value: unknown) {
  const period = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(period) ? period : null;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextReceiptNumber(joinCode: string | null | undefined, year: number, count: number) {
  return `${joinCode || "RENT"}-RENT-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, personId: true, role: true, name: true, email: true, phone: true },
  });
}

async function getOwnerOccupancyForTenant(tenantId: string, societyId: string, userPersonId?: string | null) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, societyId, status: "active" },
    include: {
      flat: {
        include: {
          units: {
            include: {
              occupancies: {
                where: { isActive: true, occupancyStatus: "ACTIVE" },
                include: {
                  person: {
                    include: {
                      users: {
                        select: { id: true, name: true, email: true, phone: true, role: true },
                      },
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!tenant) return null;

  const unit = tenant.flat.units[0];
  const ownerOccupancies = unit?.occupancies.filter((occupancy) =>
    OWNER_RELATIONSHIPS.includes(occupancy.relationshipType)
  ) || [];
  const activeTenantOccupancy = unit?.occupancies.find((occupancy) => occupancy.relationshipType === "TENANT");
  const currentOwner = ownerOccupancies.find((occupancy) => occupancy.personId === userPersonId) || null;
  const primaryOwner = currentOwner || ownerOccupancies.find((occupancy) => occupancy.isPrimaryOccupant) || ownerOccupancies[0] || null;

  return { tenant, unit, currentOwner, primaryOwner, activeTenantOccupancy };
}

const LEGACY_ROUTE = "/api/rent-invoices";
const NEST_GET = "/api/v1/finance-core/invoices/list";
const NEST_POST = "/api/v1/finance-core/invoices/create";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser(session.userId);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerOccupancies = user.personId
      ? await prisma.unitOccupancy.findMany({
          where: {
            societyId: session.societyId,
            personId: user.personId,
            relationshipType: { in: OWNER_RELATIONSHIPS },
            isActive: true,
            occupancyStatus: "ACTIVE",
          },
          include: {
            unit: {
              include: {
                legacyFlat: {
                  include: {
                    tenants: { where: { status: "active" }, orderBy: { createdAt: "desc" } },
                  },
                },
              },
            },
          },
        })
      : [];

    const ownerTenantIds = ownerOccupancies.flatMap((occupancy) =>
      (occupancy.unit.legacyFlat?.tenants || []).map((tenant) => tenant.id)
    );
    const ownerInvoices = ownerTenantIds.length
      ? await prisma.rentInvoice.findMany({
          where: { societyId: session.societyId, tenantId: { in: ownerTenantIds } },
          include: { tenant: true, flat: true },
          orderBy: { dueDate: "desc" },
        })
      : [];

    const ownerRentals = ownerOccupancies.flatMap((occupancy) => {
      const flat = occupancy.unit.legacyFlat;
      if (!flat) return [];
      return flat.tenants.map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
        tenantUserId: tenant.userId,
        flatId: flat.id,
        flatNumber: flat.flatNumber,
        wing: flat.wing,
        monthlyRent: tenant.monthlyRent || 0,
        leaseStart: tenant.leaseStart,
        leaseEnd: tenant.leaseEnd,
        invoices: ownerInvoices.filter((invoice) => invoice.tenantId === tenant.id),
      }));
    });

    const tenantInvoices = await prisma.rentInvoice.findMany({
      where: {
        societyId: session.societyId,
        OR: [
          { tenantUserId: session.userId },
          { tenant: { userId: session.userId } },
          ...(user.phone ? [{ tenant: { phone: user.phone } }] : []),
        ],
      },
      include: { tenant: true, flat: true, society: { select: { joinCode: true } } },
      orderBy: { dueDate: "desc" },
    });

    const ownerIds = tenantInvoices.map((invoice) => invoice.ownerUserId).filter(Boolean) as string[];
    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, phone: true, email: true },
        })
      : [];
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

    const tenantRentInvoices = tenantInvoices.map((invoice) => ({
      ...invoice,
      owner: invoice.ownerUserId ? ownerById.get(invoice.ownerUserId) || null : null,
    }));

    const stats = {
      rentPending: tenantInvoices
        .filter((invoice) => invoice.status === "pending")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      rentPaid: tenantInvoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + (invoice.paidAmount || invoice.amount), 0),
      ownerPending: ownerInvoices
        .filter((invoice) => invoice.status === "pending")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      ownerReceived: ownerInvoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + (invoice.paidAmount || invoice.amount), 0),
    };

    return Response.json({ ownerRentals, tenantRentInvoices, stats });
  } catch (error) {
    console.error("Failed to fetch rent invoices:", error);
    return Response.json({ error: "Failed to fetch rent invoices" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser(session.userId);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = String(body.tenantId || "");
    const period = parsePeriod(body.period);
    const dueDate = parseDate(body.dueDate);
    const amount = parseAmount(body.amount);

    if (!tenantId || !period || !dueDate || !amount) {
      return Response.json({ error: "Tenant, period, amount and due date are required" }, { status: 400 });
    }

    const context = await getOwnerOccupancyForTenant(tenantId, session.societyId, user.personId);
    if (!context) {
      return Response.json({ error: "Active tenant not found" }, { status: 404 });
    }

    if (!context.currentOwner) {
      return Response.json({ error: "Only the linked owner can raise private rent invoices" }, { status: 403 });
    }

    const ownerUserId = context.primaryOwner?.person.users[0]?.id || session.userId;
    const tenantUserId = context.tenant.userId || context.activeTenantOccupancy?.person.users[0]?.id || null;

    const invoice = await prisma.rentInvoice.create({
      data: {
        societyId: session.societyId,
        flatId: context.tenant.flatId,
        tenantId: context.tenant.id,
        ownerUserId,
        tenantUserId,
        period,
        amount,
        dueDate,
      },
      include: { tenant: true, flat: true },
    });

    if (tenantUserId) {
      await createNotification({
        societyId: session.societyId,
        userId: tenantUserId,
        type: "rent_invoice",
        title: `Private rent due - ${invoice.flat.flatNumber}`,
        message: `${user.name} raised rent invoice of ₹${amount.toLocaleString("en-IN")} for ${period}.`,
        link: "/my-bills",
      });
    }

    return Response.json({ invoice });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2002") {
      return Response.json({ error: "Rent invoice for this tenant and month already exists" }, { status: 400 });
    }
    console.error("Failed to create rent invoice:", error);
    return Response.json({ error: "Failed to create rent invoice" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const invoiceId = String(body.invoiceId || "");
    const action = String(body.action || "");

    if (!invoiceId || !["mark_paid", "tenant_pay"].includes(action)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const invoice = await prisma.rentInvoice.findFirst({
      where: { id: invoiceId, societyId: session.societyId },
      include: { society: { select: { joinCode: true } }, tenant: true, flat: true },
    });

    if (!invoice) {
      return Response.json({ error: "Rent invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return Response.json({ error: "Rent invoice is already paid" }, { status: 400 });
    }

    const isOwner = invoice.ownerUserId === session.userId;
    const isTenant = invoice.tenantUserId === session.userId || invoice.tenant.userId === session.userId;
    const isAdmin = ["chairman", "secretary", "treasurer"].includes(session.role);
    if (action === "mark_paid" && !isOwner && !isAdmin) {
      return Response.json({ error: "Only the linked owner can record private rent payment" }, { status: 403 });
    }
    if (action === "tenant_pay" && !isTenant) {
      return Response.json({ error: "Only the billed tenant can pay this rent invoice" }, { status: 403 });
    }

    const year = new Date().getFullYear();
    const existingReceipts = await prisma.rentInvoice.count({
      where: {
        societyId: session.societyId,
        receiptNumber: { startsWith: `${invoice.society.joinCode || "RENT"}-RENT-${year}` },
      },
    });

    const updated = await prisma.rentInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paidVia: body.paidVia ? String(body.paidVia) : action === "tenant_pay" ? "tenant_payment" : "private",
        paidAmount: invoice.amount,
        receiptNote: body.receiptNote ? String(body.receiptNote) : action === "tenant_pay" ? "Paid by tenant from portal" : null,
        receiptNumber: invoice.receiptNumber || nextReceiptNumber(invoice.society.joinCode, year, existingReceipts),
      },
      include: { tenant: true, flat: true },
    });

    if (invoice.ownerUserId) {
      await createNotification({
        societyId: session.societyId,
        userId: invoice.ownerUserId,
        type: "rent_paid",
        title: `Private rent paid - ${invoice.flat.flatNumber}`,
        message: `${invoice.tenant.name} paid ₹${invoice.amount.toLocaleString("en-IN")} rent for ${invoice.period}.`,
        link: "/my-bills",
      });
    }

    if (invoice.tenantUserId) {
      await createNotification({
        societyId: session.societyId,
        userId: invoice.tenantUserId,
        type: "rent_paid",
        title: `Private rent received - ${invoice.flat.flatNumber}`,
        message: `Rent payment of ₹${invoice.amount.toLocaleString("en-IN")} for ${invoice.period} was recorded.`,
        link: "/my-bills",
      });
    }

    return Response.json({ invoice: updated });
  } catch (error) {
    console.error("Failed to update rent invoice:", error);
    return Response.json({ error: "Failed to update rent invoice" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/rent-invoices", nestPath: "/api/v1/finance-core/invoices/create", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/rent-invoices", nestPath: "/api/v1/finance-core/invoices/create", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/rent-invoices", nestPath: "/api/v1/finance-core/invoices/create", method: "PATCH" }, legacyPATCH);
