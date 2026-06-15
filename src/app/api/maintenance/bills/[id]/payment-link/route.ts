import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  buildReminderPayload,
  ensureBillPaymentLink,
  markPaymentLinkSent,
} from "@/lib/payment-link-service";

function requestOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const sentVia = typeof body.sentVia === "string" ? body.sentVia : "copy";
  const payerPhone = typeof body.payerPhone === "string" ? body.payerPhone : null;

  try {
    const { link, bill, payUrl } = await ensureBillPaymentLink({
      societyId: session.societyId,
      billId: id,
      createdBy: session.userId,
      origin: requestOrigin(request),
    });

    const reminder = buildReminderPayload({ bill, payUrl, payerPhone });

    if (sentVia === "whatsapp") {
      await markPaymentLinkSent(link.id, "whatsapp", reminder.phone);
    } else {
      await markPaymentLinkSent(link.id, sentVia, reminder.phone);
    }

    return Response.json({
      payUrl,
      token: link.token,
      expiresAt: link.expiresAt.toISOString(),
      whatsAppUrl: reminder.whatsAppUrl,
      message: reminder.message,
      payerPhone: reminder.phone,
      flatNumber: bill.flat.flatNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment link";
    const status = message === "Bill not found" ? 404 : message === "Bill is already paid" ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
