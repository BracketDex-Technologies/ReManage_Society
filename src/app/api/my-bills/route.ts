import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillingTargetsForSociety, targetsByFlatId } from "@/domain/billing";
import { getResidentFlatForSession, noFlatLinkedPayload } from "@/lib/resident-flat";
import { committeeSelfServiceError, isResidentRole } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const committeeError = committeeSelfServiceError(session.role);
  if (committeeError) {
    return Response.json({ error: committeeError }, { status: 403 });
  }
  if (!isResidentRole(session.role)) {
    return Response.json({ error: "Only flat residents can view personal bills" }, { status: 403 });
  }

  const flat = await getResidentFlatForSession(session);
  if (!flat) {
    return Response.json({
      bills: [],
      stats: { totalPending: 0, totalPaid: 0 },
      ...noFlatLinkedPayload(),
    });
  }

  const billingTargets = await getBillingTargetsForSociety(session.societyId);
  const targetByFlatId = targetsByFlatId(billingTargets);

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      societyId: session.societyId,
      flatId: flat.id,
    },
    include: {
      flat: true,
      society: {
        select: {
          name: true,
          upiId: true,
          bankDetails: true,
        }
      }
    },
    orderBy: { dueDate: "desc" },
  });
  const visibleBills = bills
    .map((bill) => ({ ...bill, billingRecipient: targetByFlatId.get(bill.flatId) || null }))
    .filter((bill) => {
      if (!bill.billingRecipient) return true;
      return bill.billingRecipient.userIds.includes(session.userId);
    });

  const stats = {
    totalPending: visibleBills
      .filter((b) => b.status === "pending" || b.status === "partial")
      .reduce((acc, b) => acc + ((b.totalAmount || b.amount + b.lateFee + b.gstAmount) - (b.paidAmount || 0)), 0),
    totalPaid: visibleBills.filter((b) => b.status === "paid" || b.status === "partial").reduce((acc, b) => acc + (b.paidAmount || 0), 0),
  };

  return Response.json({ bills: visibleBills, stats });
}
