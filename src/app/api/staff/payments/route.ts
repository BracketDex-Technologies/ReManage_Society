import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResidentFlatForSession, noFlatLinkedPayload } from "@/lib/resident-flat";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/staff/payments";
const NEST_GET = "/api/v1/operations/staff/payments/list";
const NEST_POST = "/api/v1/operations/staff/payments/process";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId || !["member", "tenant"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flat = await getResidentFlatForSession(session);
    if (!flat) {
      return Response.json({
        flat: null,
        linkedStaff: [],
        payments: [],
        stats: { pending: 0, paid: 0, linkedStaff: 0 },
        defaultMonth: currentMonth(),
        ...noFlatLinkedPayload(),
      });
    }

    const [staffLinks, payments] = await Promise.all([
      prisma.staffFlatLink.findMany({
        where: { flatId: flat.id, isActive: true, staff: { isActive: true } },
        include: { staff: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.residentStaffPayment.findMany({
        where: { societyId: session.societyId, flatId: flat.id },
        include: { staff: true },
        orderBy: [{ month: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
    ]);

    const stats = {
      pending: payments.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0),
      paid: payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
      linkedStaff: staffLinks.length,
    };

    return Response.json({
      flat,
      linkedStaff: staffLinks.map((link) => ({
        id: link.staff.id,
        name: link.staff.name,
        phone: link.staff.phone,
        category: link.staff.category,
        schedule: link.schedule,
        agreedMonthlyPay: link.agreedMonthlyPay,
      })),
      payments,
      stats,
      defaultMonth: currentMonth(),
    });
  } catch (error) {
    console.error("Failed to fetch resident staff payments:", error);
    return Response.json({ error: "Failed to fetch staff payments" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["member", "tenant"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flat = await getResidentFlatForSession(session);
    if (!flat) {
      return Response.json({ error: "No flat linked to this account" }, { status: 400 });
    }

    const body = await request.json();
    const staffId = String(body.staffId || "");
    const month = String(body.month || currentMonth());
    const amount = parseAmount(body.amount);

    if (!staffId || !/^\d{4}-\d{2}$/.test(month) || !amount) {
      return Response.json({ error: "Staff, month and valid amount are required" }, { status: 400 });
    }

    const link = await prisma.staffFlatLink.findFirst({
      where: { flatId: flat.id, staffId, isActive: true, staff: { societyId: session.societyId, isActive: true } },
      include: { staff: true },
    });

    if (!link) {
      return Response.json({ error: "This staff member is not linked to your flat" }, { status: 403 });
    }

    const payment = await prisma.residentStaffPayment.upsert({
      where: { flatId_staffId_month: { flatId: flat.id, staffId, month } },
      create: {
        societyId: session.societyId,
        flatId: flat.id,
        staffId,
        payerUserId: session.userId,
        month,
        amount,
        note: body.note ? String(body.note) : null,
      },
      update: {
        amount,
        note: body.note ? String(body.note) : null,
        payerUserId: session.userId,
      },
      include: { staff: true },
    });

    return Response.json({ payment });
  } catch (error) {
    console.error("Failed to create resident staff payment:", error);
    return Response.json({ error: "Failed to create staff payment" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["member", "tenant"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flat = await getResidentFlatForSession(session);
    if (!flat) {
      return Response.json({ error: "No flat linked to this account" }, { status: 400 });
    }

    const body = await request.json();
    const paymentId = String(body.paymentId || "");
    const action = String(body.action || "");

    if (!paymentId || action !== "mark_paid") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const payment = await prisma.residentStaffPayment.findFirst({
      where: { id: paymentId, societyId: session.societyId, flatId: flat.id },
    });

    if (!payment) {
      return Response.json({ error: "Payment record not found" }, { status: 404 });
    }

    const updated = await prisma.residentStaffPayment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paidOn: new Date(),
        paidVia: body.paidVia ? String(body.paidVia) : "cash",
        payerUserId: session.userId,
        note: body.note ? String(body.note) : payment.note,
      },
      include: { staff: true },
    });

    return Response.json({ payment: updated });
  } catch (error) {
    console.error("Failed to update resident staff payment:", error);
    return Response.json({ error: "Failed to update staff payment" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_GET, method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_POST, method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_POST, method: "PATCH" }, legacyPATCH);
