import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logPayment } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import { recordMaintenanceBillPayment } from "@/domain/maintenance-finance";
import { committeeSelfServiceError, isResidentRole } from "@/lib/roles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const committeeError = committeeSelfServiceError(session.role);
  if (committeeError) {
    return Response.json({ error: committeeError }, { status: 403 });
  }
  if (!isResidentRole(session.role)) {
    return Response.json({ error: "Only flat residents can pay personal bills" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || !user.flatId) {
    return Response.json({ error: "No flat assigned" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.findFirst({
    where: { id, societyId: session!.societyId, flatId: user.flatId },
    include: {
      flat: true,
      society: { select: { joinCode: true } },
    },
  });

  if (!bill) {
    return Response.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status === "paid") {
    return Response.json({ error: "Bill is already paid" }, { status: 400 });
  }

  const totalAmount = bill.totalAmount || bill.amount + bill.lateFee + bill.gstAmount;
  if (totalAmount <= 0) {
    return Response.json({ error: "Invoice amount is not set. Please contact society admin." }, { status: 400 });
  }

  const paidVia = body.paidVia || "upi";
  const receiptNote = body.utrNumber ? `UPI UTR: ${body.utrNumber}` : "Manual payment recorded from resident portal";
  const updated = await prisma.$transaction(async (tx) => {
    return recordMaintenanceBillPayment(tx, {
      societyId: session!.societyId,
      billId: id,
      desiredPaidAmount: totalAmount,
      paidVia,
      paidAt: new Date(),
      receiptNote,
      reference: body.utrNumber || null,
      createdBy: session.userId,
    });
  });

  // Audit log
  await logPayment(id, `Flat ${bill.flat.flatNumber} - ${bill.period}`, {
    amount: totalAmount,
    method: paidVia,
    status: "paid",
    ownerName: bill.flat.ownerName,
    utrNumber: body.utrNumber || null,
  });

  const committeeUsers = await prisma.user.findMany({
    where: { societyId: session!.societyId, role: { in: ["chairman", "secretary", "treasurer"] } },
    select: { id: true },
  });
  await Promise.all(committeeUsers.map((committeeUser) =>
    createNotification({
      societyId: session!.societyId,
      userId: committeeUser.id,
      type: "bill_paid",
      title: `Online Payment Received - Flat ${bill.flat.flatNumber}`,
      message: `₹${totalAmount} received from ${user.name} via ${(body.paidVia || "upi").toUpperCase()}${body.utrNumber ? ` · UTR ${body.utrNumber}` : ""}.`,
      link: "/maintenance",
    })
  ));

  return Response.json({ bill: updated });
}
