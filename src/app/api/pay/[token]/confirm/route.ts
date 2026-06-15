import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { resolvePublicPaymentLink } from "@/lib/payment-link-service";
import { billTotalAmount } from "@/lib/payment-link";
import { recordMaintenanceBillPayment } from "@/domain/maintenance-finance";
import { logPayment } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";

function requestOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const utrNumber = typeof body.utrNumber === "string" ? body.utrNumber.trim() : "";

  if (!utrNumber || utrNumber.length < 6) {
    return Response.json({ error: "Enter a valid UPI transaction reference (UTR)" }, { status: 400 });
  }

  const resolved = await resolvePublicPaymentLink(token, requestOrigin(request));
  if ("error" in resolved) {
    const status = resolved.error === "expired" ? 410 : 404;
    return Response.json(
      { error: resolved.error === "expired" ? "This payment link has expired." : "Payment link not found" },
      { status },
    );
  }

  const bill = resolved.bill;
  if (bill.status === "paid") {
    return Response.json({ error: "This bill is already paid", bill: resolved.publicBill }, { status: 400 });
  }

  const total = billTotalAmount(bill);
  const remaining = Math.max(0, Math.round((total - (bill.paidAmount ?? 0)) * 100) / 100);
  if (remaining <= 0) {
    return Response.json({ error: "Nothing due on this bill", bill: resolved.publicBill }, { status: 400 });
  }

  const receiptNote = `UPI UTR: ${utrNumber} (public pay link)`;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      return recordMaintenanceBillPayment(tx, {
        societyId: bill.societyId,
        billId: bill.id,
        desiredPaidAmount: total,
        paidVia: "upi",
        paidAt: new Date(),
        receiptNote,
        reference: utrNumber,
      });
    });

    await logPayment(bill.id, `Flat ${bill.flat.flatNumber} - ${bill.period}`, {
      amount: remaining,
      method: "upi",
      status: updated.status,
      ownerName: bill.flat.ownerName,
      utrNumber,
      source: "public_payment_link",
    });

    const committeeUsers = await prisma.user.findMany({
      where: { societyId: bill.societyId, role: { in: ["chairman", "secretary", "treasurer"] } },
      select: { id: true },
    });

    await Promise.all(
      committeeUsers.map((committeeUser) =>
        createNotification({
          societyId: bill.societyId,
          userId: committeeUser.id,
          type: "bill_paid",
          title: `Online Payment - Flat ${bill.flat.flatNumber}`,
          message: `₹${remaining.toLocaleString("en-IN")} received via public pay link · UTR ${utrNumber}`,
          link: "/maintenance",
        }),
      ),
    );

    const refreshed = await resolvePublicPaymentLink(token, requestOrigin(request));
    return Response.json({
      success: true,
      bill: "publicBill" in refreshed ? refreshed.publicBill : resolved.publicBill,
      receiptNumber: updated.receiptNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment could not be recorded";
    return Response.json({ error: message }, { status: 400 });
  }
}
