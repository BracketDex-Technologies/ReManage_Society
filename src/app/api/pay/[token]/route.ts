import { NextRequest } from "next/server";
import { resolvePublicPaymentLink } from "@/lib/payment-link-service";
import { billTotalAmount, buildUpiDeepLink } from "@/lib/payment-link";

function requestOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const resolved = await resolvePublicPaymentLink(token, requestOrigin(request));

  if ("error" in resolved) {
    if (resolved.error === "expired") {
      return Response.json({ error: "This payment link has expired. Please contact your society office." }, { status: 410 });
    }
    return Response.json({ error: "Payment link not found" }, { status: 404 });
  }

  const bill = resolved.bill;
  const total = billTotalAmount(bill);
  const remaining = Math.max(0, Math.round((total - (bill.paidAmount ?? 0)) * 100) / 100);
  const transactionRef = `PAY-${bill.period}-${bill.flat.flatNumber}`.replace(/\s+/g, "");
  const transactionNote = `${bill.description || "Society dues"} ${bill.period}`;

  const upiDeepLink =
    bill.society.upiId && remaining > 0
      ? buildUpiDeepLink({
          upiId: bill.society.upiId,
          payeeName: bill.society.name,
          amount: remaining,
          transactionRef,
          transactionNote,
        })
      : null;

  return Response.json({
    bill: resolved.publicBill,
    upiDeepLink,
    transactionRef,
  });
}
