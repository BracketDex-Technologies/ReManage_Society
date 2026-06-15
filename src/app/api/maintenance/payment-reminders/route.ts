import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  buildReminderPayload,
  ensureBillPaymentLink,
  markPaymentLinkSent,
} from "@/lib/payment-link-service";
import { billTotalAmount } from "@/lib/payment-link";

function requestOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const period = typeof body.period === "string" ? body.period : null;
  const openWhatsApp = body.openWhatsApp === true;

  if (!period) {
    return Response.json({ error: "Billing period is required" }, { status: 400 });
  }

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      societyId: session.societyId,
      period,
      status: { in: ["pending", "partial"] },
    },
    include: {
      flat: { select: { flatNumber: true, ownerName: true, contact: true } },
      society: { select: { name: true, upiId: true } },
    },
    orderBy: { flat: { flatNumber: "asc" } },
  });

  if (bills.length === 0) {
    return Response.json({ error: "No pending bills for this period" }, { status: 400 });
  }

  const origin = requestOrigin(request);
  const reminders: Array<{
    billId: string;
    flatNumber: string;
    payerPhone: string | null;
    payUrl: string;
    whatsAppUrl: string;
    amount: number;
  }> = [];

  for (const bill of bills) {
    const remaining = billTotalAmount(bill) - (bill.paidAmount ?? 0);
    if (remaining <= 0) continue;

    const { link, payUrl } = await ensureBillPaymentLink({
      societyId: session.societyId,
      billId: bill.id,
      createdBy: session.userId,
      origin,
    });

    const reminder = buildReminderPayload({ bill, payUrl });
    await markPaymentLinkSent(link.id, "bulk", reminder.phone);

    reminders.push({
      billId: bill.id,
      flatNumber: bill.flat.flatNumber,
      payerPhone: reminder.phone,
      payUrl,
      whatsAppUrl: reminder.whatsAppUrl,
      amount: remaining,
    });
  }

  return Response.json({
    period,
    count: reminders.length,
    reminders,
    openWhatsApp,
    message: `${reminders.length} payment links ready to share`,
  });
}
