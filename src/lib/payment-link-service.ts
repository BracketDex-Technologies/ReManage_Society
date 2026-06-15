import { prisma } from "@/lib/prisma";
import {
  buildPaymentReminderMessage,
  buildPublicPayUrl,
  buildWhatsAppShareUrl,
  generatePaymentLinkToken,
  paymentLinkExpiresAt,
  serializePublicBillView,
} from "@/lib/payment-link";

const billInclude = {
  flat: { select: { flatNumber: true, ownerName: true, contact: true } },
  society: { select: { name: true, upiId: true } },
} as const;

export async function ensureBillPaymentLink(params: {
  societyId: string;
  billId: string;
  createdBy?: string;
  origin?: string;
}) {
  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: params.billId, societyId: params.societyId },
    include: billInclude,
  });
  if (!bill) {
    throw new Error("Bill not found");
  }
  if (bill.status === "paid") {
    throw new Error("Bill is already paid");
  }

  const now = new Date();
  const existing = await prisma.billPaymentLink.findFirst({
    where: {
      billId: bill.id,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  const link =
    existing ??
    (await prisma.billPaymentLink.create({
      data: {
        societyId: params.societyId,
        billId: bill.id,
        token: generatePaymentLinkToken(),
        expiresAt: paymentLinkExpiresAt(now),
        createdBy: params.createdBy,
      },
    }));

  const payUrl = buildPublicPayUrl(link.token, params.origin);
  return {
    link,
    bill,
    payUrl,
    publicBill: serializePublicBillView(bill, payUrl),
  };
}

export async function resolvePublicPaymentLink(token: string, origin?: string) {
  const link = await prisma.billPaymentLink.findUnique({
    where: { token },
    include: {
      bill: { include: billInclude },
    },
  });

  if (!link) {
    return { error: "not_found" as const };
  }
  if (link.expiresAt < new Date()) {
    return { error: "expired" as const, bill: link.bill };
  }

  const payUrl = buildPublicPayUrl(link.token, origin);
  return {
    link,
    bill: link.bill,
    payUrl,
    publicBill: serializePublicBillView(link.bill, payUrl),
  };
}

export function buildReminderPayload(input: {
  bill: Awaited<ReturnType<typeof ensureBillPaymentLink>>["bill"];
  payUrl: string;
  payerPhone?: string | null;
}) {
  const total =
    input.bill.totalAmount ??
    input.bill.amount + input.bill.lateFee + input.bill.gstAmount;
  const message = buildPaymentReminderMessage({
    societyName: input.bill.society.name,
    flatNumber: input.bill.flat.flatNumber,
    period: input.bill.period,
    amount: total,
    dueDate: input.bill.dueDate,
    payUrl: input.payUrl,
    description: input.bill.description,
  });
  const phone = input.payerPhone || input.bill.flat.contact || null;

  return {
    message,
    whatsAppUrl: buildWhatsAppShareUrl(message, phone),
    phone,
  };
}

export async function markPaymentLinkSent(
  linkId: string,
  sentVia: string,
  sentToPhone?: string | null,
) {
  await prisma.billPaymentLink.update({
    where: { id: linkId },
    data: {
      lastSentAt: new Date(),
      sentVia,
      sentToPhone: sentToPhone || null,
    },
  });
}
