import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getCurrentPeriod } from "@/lib/utils";
import { logCreated } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import { getBillingTargetsForSociety, targetsByFlatId } from "@/domain/billing";
import { ensureMaintenanceBillInvoice } from "@/domain/maintenance-finance";
import { billDueRecipientUserIds } from "@/domain/notification-recipients";

import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/maintenance/bills";
const NEST_GET = "/api/v1/finance-core/maintenance/bills/list";
const NEST_POST = "/api/v1/finance-core/maintenance/bills/generate";

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || getCurrentPeriod();
  const status = searchParams.get("status") || "all";
  const search = searchParams.get("search") || "";
  const targetBillType = searchParams.get("billType") || "maintenance";
  const targetBillingCycle = searchParams.get("billingCycle") || "monthly";
  const billingTargets = await getBillingTargetsForSociety(session.societyId);
  const billingTargetByFlatId = targetsByFlatId(billingTargets);
  const billableFlatIds = billingTargets.map((target) => target.flatId);
  const society = await prisma.society.findUnique({
    where: { id: session.societyId },
    select: { maintenanceAmt: true, dueDayOfMonth: true },
  });

  const where: Record<string, unknown> = {
    societyId: session!.societyId,
    period,
    flatId: { in: billableFlatIds },
  };

  if (status !== "all") {
    where.status = status;
  }

  if (search) {
    where.flat = {
      OR: [
        { flatNumber: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
        { tenantName: { contains: search, mode: "insensitive" } },
        { users: { some: { name: { contains: search, mode: "insensitive" } } } },
      ],
    };
  }

  const rawBills = await prisma.maintenanceBill.findMany({
    where,
    include: {
      flat: {
        include: {
          users: {
            where: { role: { in: ["member", "tenant"] } },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      },
    },
    orderBy: { flat: { flatNumber: "asc" } },
  });

  const allBills = await prisma.maintenanceBill.findMany({
    where: {
      societyId: session!.societyId,
      period,
      flatId: { in: billableFlatIds },
    },
  });
  const billedFlatIds = new Set(
    allBills
      .filter((bill) => bill.billType === targetBillType && bill.billingCycle === targetBillingCycle)
      .map((bill) => bill.flatId)
  );
  const bills = rawBills.map((bill) => ({
    ...bill,
    billingRecipient: billingTargetByFlatId.get(bill.flatId) || null,
  }));

  const paidBills = allBills.filter((b) => b.status === "paid");
  const partialBills = allBills.filter((b) => b.status === "partial");
  const pendingBills = allBills.filter((b) => b.status === "pending");

  return jsonWithHeaders(
    {
    bills,
    availableFlats: billingTargets
      .filter((target) => !billedFlatIds.has(target.flatId))
      .map((target) => ({
        id: target.flatId,
        flatNumber: target.flatNumber,
        ownerName: target.payerName,
        role: target.payerRole,
        linkedOwnerName: target.ownerName,
        linkedOwnerPhone: target.ownerPhone,
        linkedOwnerEmail: target.ownerEmail,
        tenantName: target.tenantName,
        tenantPhone: target.tenantPhone,
        privateMonthlyRent: target.privateMonthlyRent,
        billingResponsibility: target.billingResponsibility,
        payerName: target.payerName,
        payerRole: target.payerRole,
        payerPhone: target.payerPhone,
        payerEmail: target.payerEmail,
      })),
    defaultInvoiceAmount: society?.maintenanceAmt || 0,
    defaultDueDayOfMonth: society?.dueDayOfMonth || 10,
    summary: {
      paid: paidBills.length,
      partial: partialBills.length,
      pending: pendingBills.length,
      total: allBills.length,
      collectedAmount: paidBills.reduce((s, b) => s + (b.paidAmount || b.amount), 0)
        + partialBills.reduce((s, b) => s + (b.paidAmount || 0), 0),
      pendingAmount: pendingBills.reduce((s, b) => s + (b.totalAmount || b.amount + b.lateFee + b.gstAmount), 0)
        + partialBills.reduce((s, b) => s + ((b.totalAmount || b.amount + b.lateFee + b.gstAmount) - (b.paidAmount || 0)), 0),
    },
    },
    {
      status: 200,
      extraHeaders: buildDeprecationHeaders({
        routePath: "/api/maintenance/bills",
        successorPath: "/api/v1/finance-core/invoices/create",
      }),
    },
  );
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { period, amount, dueDate, flatIds, billType, billingCycle, description } = await request.json();
    const targetPeriod = period || getCurrentPeriod();
    const targetBillType = billType || "maintenance";
    const targetBillingCycle = billingCycle || "monthly";

    // Get society settings
    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
    });

    if (!society) {
      return Response.json({ error: "Society not found" }, { status: 404 });
    }

    const invoiceAmount = Number(amount || society.maintenanceAmt || 0);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
      return Response.json(
        { error: "Set a valid maintenance amount before generating invoices" },
        { status: 400 }
      );
    }

    // Generate invoices only for active units with an occupancy-aware payer.
    const selectedFlatIds = Array.isArray(flatIds) ? flatIds.filter(Boolean) : [];
    if (!selectedFlatIds.length) {
      return Response.json({ error: "Select at least one flat to raise invoices" }, { status: 400 });
    }

    const billingTargets = await getBillingTargetsForSociety(session.societyId);
    const billingTargetByFlatId = targetsByFlatId(billingTargets);
    const billableFlatIds = billingTargets.map((target) => target.flatId);
    const activeFlats = await prisma.flat.findMany({
      where: {
        societyId: session!.societyId,
        isActive: true,
        id: { in: selectedFlatIds },
        AND: [{ id: { in: billableFlatIds } }],
      },
    });

    // Get existing bills for this period to skip them
    const existingBills = await prisma.maintenanceBill.findMany({
      where: {
        societyId: session!.societyId,
        period: targetPeriod,
        billType: targetBillType,
        billingCycle: targetBillingCycle,
        flatId: { in: selectedFlatIds },
      },
      select: { flatId: true }
    });
    const existingFlatIds = new Set(existingBills.map(b => b.flatId));

    // Calculate due date
    const [year, month] = targetPeriod.split("-").map(Number);
    const billDueDate = dueDate ? new Date(dueDate) : new Date(year, month - 1, society.dueDayOfMonth);

    // Generate bills for flats that don't have one
    let generated = 0;
    let skipped = 0;

    for (const flat of activeFlats) {
      if (existingFlatIds.has(flat.id)) {
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const bill = await tx.maintenanceBill.create({
          data: {
            flatId: flat.id,
            societyId: session!.societyId,
            amount: invoiceAmount,
            billType: targetBillType,
            billingCycle: targetBillingCycle,
            description: description || null,
            totalAmount: invoiceAmount,
            period: targetPeriod,
            dueDate: billDueDate,
          },
        });
        await ensureMaintenanceBillInvoice(tx, {
          societyId: session!.societyId,
          billId: bill.id,
          createdBy: session.userId,
        });
      });
      generated++;

      const target = billingTargetByFlatId.get(flat.id);
      const recipientUserIds = billDueRecipientUserIds(target);
      await Promise.all(recipientUserIds.map((userId) =>
        createNotification({
          societyId: session!.societyId,
          userId,
          type: "bill_due",
          title: `${description || "Society dues"} invoice for ${targetPeriod}`,
          message: `₹${invoiceAmount} ${description || "society dues"} invoice raised for Flat ${flat.flatNumber}. Billed to ${target?.payerName || "resident"}. Due by ${billDueDate.toLocaleDateString("en-IN")}.`,
          link: "/my-bills",
        })
      ));
    }

    if (generated > 0) {
      // Audit log if we actually generated new ones
      await logCreated("bill", targetPeriod, `Bills for ${targetPeriod}`, {
        generated,
        totalFlats: activeFlats.length,
        amount: invoiceAmount,
      });
    }

    return Response.json({ generated, skipped });
  } catch (error) {
    console.error("Error generating bills:", error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/maintenance/bills", nestPath: "/api/v1/finance-core", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/maintenance/bills", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
