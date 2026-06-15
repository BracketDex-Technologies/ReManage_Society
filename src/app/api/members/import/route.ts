import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getCurrentPeriod } from "@/lib/utils";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/members/import";
const NEST_POST = "/api/v1/society-core/members/import/import";

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { members } = await request.json();

    if (!Array.isArray(members) || members.length === 0) {
      return Response.json(
        { error: "No members to import" },
        { status: 400 }
      );
    }

    // Fetch society to get billing settings
    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
      select: { maintenanceAmt: true, dueDayOfMonth: true }
    });

    if (!society) {
      return Response.json({ error: "Society not found" }, { status: 404 });
    }

    // Check if any bills already exist for current period
    const currentPeriod = getCurrentPeriod();
    const billsExist = await prisma.maintenanceBill.findFirst({
      where: { societyId: session!.societyId, period: currentPeriod }
    });

    const [year, month] = currentPeriod.split("-").map(Number);
    const dueDate = new Date(year, month - 1, society.dueDayOfMonth);

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < members.length; i++) {
      const row = members[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.flat_number && !row.flatNumber) {
        errors.push({ row: rowNum, field: "flat_number", message: "Flat number is required" });
        skipped++;
        continue;
      }
      if (!row.owner_name && !row.ownerName) {
        errors.push({ row: rowNum, field: "owner_name", message: "Owner name is required" });
        skipped++;
        continue;
      }

      const contact = row.contact?.toString().replace(/\D/g, "");
      if (!contact || contact.length !== 10) {
        errors.push({ row: rowNum, field: "contact", message: "Invalid mobile number" });
        skipped++;
        continue;
      }

      const flatNumber = row.flat_number || row.flatNumber.toString();

      // Check for duplicate
      const existing = await prisma.flat.findFirst({
        where: { societyId: session!.societyId, flatNumber },
      });

      if (existing) {
        errors.push({
          row: rowNum,
          field: "flat_number",
          message: `Flat ${flatNumber} already exists`,
        });
        skipped++;
        continue;
      }

      try {
        const flat = await prisma.flat.create({
          data: {
            societyId: session!.societyId,
            flatNumber,
            wing: row.wing || null,
            floor: row.floor ? parseInt(row.floor) : null,
            ownerName: row.owner_name || row.ownerName,
            tenantName: row.tenant_name || row.tenantName || null,
            contact,
            email: row.email || null,
            vehicleNumber: row.vehicle_number || row.vehicleNumber || null,
          },
        });
        imported++;

        // Automatically create bill if bills exist for this period
        if (billsExist) {
          await prisma.maintenanceBill.create({
            data: {
              flatId: flat.id,
              societyId: session!.societyId,
              amount: society.maintenanceAmt,
              period: currentPeriod,
              dueDate,
            }
          });
        }
      } catch (error) {
        console.error("Failed to import member:", error);
        errors.push({ row: rowNum, field: "unknown", message: "Failed to import" });
        skipped++;
      }
    }

    // Update totalFlats record
    const flatCount = await prisma.flat.count({
      where: { societyId: session!.societyId, isActive: true },
    });
    await prisma.society.update({
      where: { id: session!.societyId },
      data: { totalFlats: flatCount },
    });

    return Response.json({ imported, skipped, errors });
  } catch (error) {
    console.error("Import error:", error);
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export const POST = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "POST" }, legacyPOST);
