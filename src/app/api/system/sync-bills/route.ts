import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriod } from "@/lib/utils";
import { getBillingTargetsForSociety } from "@/domain/billing";

export async function POST() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const currentPeriod = getCurrentPeriod();
    
    // Fetch society to get billing settings
    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
      select: { name: true, maintenanceAmt: true, dueDayOfMonth: true }
    });

    if (!society) {
      return Response.json({ error: "Society not found" }, { status: 404 });
    }

    // Get active units with an occupancy-aware billing payer.
    const billingTargets = await getBillingTargetsForSociety(session.societyId);

    // Get existing bills for this period
    const existingBills = await prisma.maintenanceBill.findMany({
      where: { societyId: session!.societyId, period: currentPeriod },
      select: { flatId: true }
    });
    const existingFlatIds = new Set(existingBills.map(b => b.flatId));

    // Calculate due date
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), society.dueDayOfMonth);

    let created = 0;
    for (const target of billingTargets) {
      if (!existingFlatIds.has(target.flatId)) {
        await prisma.maintenanceBill.create({
          data: {
            flatId: target.flatId,
            societyId: session!.societyId,
            amount: society.maintenanceAmt,
            totalAmount: society.maintenanceAmt,
            period: currentPeriod,
            dueDate,
          },
        });
        created++;
      }
    }

    return Response.json({ 
        message: `Sync complete for ${society.name}`,
        period: currentPeriod,
        totalFlats: billingTargets.length,
        totalBillableUnits: billingTargets.length,
        alreadyBilled: existingBills.length,
        newlyCreated: created 
    });
  } catch (error) {
    console.error("Sync error:", error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
