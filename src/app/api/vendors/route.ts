import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logCreated } from "@/lib/activity-log";
import { scanVendorComplianceAlerts } from "@/lib/amc-compliance-service";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/vendors";
const NEST_GET = "/api/v1/operations/vendors/list";
const NEST_POST = "/api/v1/operations/vendors/create";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendors = await prisma.vendor.findMany({
    where: { societyId: session!.societyId },
    orderBy: { name: "asc" },
  });

  void scanVendorComplianceAlerts({ societyId: session!.societyId }).catch((error) => {
    console.error("AMC compliance scan failed:", error);
  });

  return Response.json({ vendors });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, category, phone, email, hasAMC, amcAmount, amcStartDate, amcEndDate, insuranceExpiryDate } = body;

    if (!name || !category) {
      return Response.json({ error: "Name and category are required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        societyId: session!.societyId,
        name,
        category,
        phone: phone || null,
        email: email || null,
        hasAMC: hasAMC || false,
        amcAmount: amcAmount ? parseFloat(amcAmount) : null,
        amcStartDate: amcStartDate ? new Date(amcStartDate) : null,
        amcEndDate: amcEndDate ? new Date(amcEndDate) : null,
        insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
      },
    });

    await logCreated("settings", vendor.id, `Added Vendor: ${name}`, {
      category,
      hasAMC,
    });

    void scanVendorComplianceAlerts({ societyId: session!.societyId }).catch((error) => {
      console.error("AMC compliance scan failed:", error);
    });

    return Response.json({ vendor }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/vendors", nestPath: "/api/v1/operations/vendors", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/vendors", nestPath: "/api/v1/operations/vendors", method: "POST" }, legacyPOST);
